import "server-only";
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db, schema as T } from "./db";
import { ApiError } from "./http";
import { originOf, rateLimit } from "./auth";
import { requireSuperAdmin, type Ctx } from "./context";
import { decodeImage } from "./images";
import { emailConfigured, layout, sendEmail } from "./email";
import { id, log, one, type Handler } from "./commands";
import { ROLE_LABEL } from "@/lib/permissions";
import { uid } from "@/lib/format";
import { HELP_ATTACHMENT_DAYS, HELP_CATEGORY_LABEL, HELP_IMAGE_MAX_BYTES, HELP_PER_HOUR, type HelpCategory, type HelpTicket } from "@/lib/help";

type Row = typeof T.helpTickets.$inferSelect;

/** "Chrome 129" / "Android" etc. from the browser's own User-Agent header (not from the form). */
function deviceOf(ua: string, screen?: string) {
  const pick = (re: RegExp, name: string) => {
    const m = re.exec(ua);
    return m ? `${name} ${m[1]}` : null;
  };
  const browser =
    pick(/Edg\/(\d+)/, "Edge") ?? pick(/SamsungBrowser\/(\d+)/, "Samsung Internet") ?? pick(/Firefox\/(\d+)/, "Firefox") ??
    pick(/Chrome\/(\d+)/, "Chrome") ?? pick(/Version\/(\d+).*Safari/, "Safari") ?? "Peramban lain";
  const os = /Android/.test(ua) ? "Android" : /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Lainnya";
  const width = screen ? Number(screen.split("x")[0]) : 0;
  const kind = /Mobi|iPhone/.test(ua) || (width && width < 600) ? "HP" : /iPad|Tablet/.test(ua) || (width && width < 1024) ? "Tablet" : "Komputer";
  return { device: `${kind} ${os}`, browser };
}

/**
 * Context sent with every message — filled in by the SERVER: the page (path only, no query), the
 * role, the related temple, device and browser. Never amounts, transactions or donor names.
 */
async function contextOf(ctx: Ctx, rawPage: string, screen?: string) {
  const path = rawPage.split(/[?#]/)[0];
  const page = /^\/[A-Za-z0-9/_-]{0,190}$/.test(path) ? path : "/";
  let temple: string | undefined;
  const slug = /^\/pura\/([a-z0-9-]+)/.exec(page)?.[1];
  if (slug) temple = (await db.select({ name: T.temples.name }).from(T.temples).where(and(eq(T.temples.slug, slug), eq(T.temples.status, "active"))))[0]?.name;
  else if (page.startsWith("/app") && ctx.templeId) temple = (await db.select({ name: T.temples.name }).from(T.temples).where(eq(T.temples.id, ctx.templeId)))[0]?.name;
  const role = ctx.user.isSuperAdmin ? "Admin Utama" : page.startsWith("/app") && ctx.role ? ROLE_LABEL[ctx.role] : ctx.role ? `${ROLE_LABEL[ctx.role]} (sedang di halaman umat)` : "Umat";
  return { page, role, temple, ...deviceOf(ctx.req.headers.get("user-agent") ?? "", screen), screen };
}

async function emailAdmins(ctx: Ctx, subject: string, intro: string) {
  if (!emailConfigured()) return;
  const admins = await db.select({ email: T.users.email }).from(T.users).where(and(eq(T.users.isSuperAdmin, true), eq(T.users.status, "active")));
  const url = `${originOf(ctx.req)}/app/admin?tab=bantuan`;
  for (const a of admins) await sendEmail(a.email, subject, layout({ title: subject, intro, button: { label: "Buka kotak bantuan", url } }), `${intro}\n\n${url}`).catch(() => {});
}

async function emailUser(ctx: Ctx, userId: string) {
  if (!emailConfigured()) return;
  const [u] = await db.select({ email: T.users.email, status: T.users.status }).from(T.users).where(eq(T.users.id, userId));
  if (!u || u.status !== "active") return;
  const url = `${originOf(ctx.req)}/bantuan`;
  const intro = "Admin Utama membalas pesan bantuan Anda. Buka aplikasi untuk membacanya.";
  await sendEmail(u.email, "Balasan untuk pesan bantuan Anda", layout({ title: "Pesan Anda sudah dibalas", intro, button: { label: "Lihat balasan", url } }), `${intro}\n\n${url}`).catch(() => {});
}

async function ticketFor(ctx: Ctx, ticketId: string) {
  const t = await one(db.select().from(T.helpTickets).where(eq(T.helpTickets.id, ticketId)), "Pesan tidak ditemukan.");
  if (t.userId !== ctx.user.id && !ctx.user.isSuperAdmin) throw new ApiError(404, "Pesan tidak ditemukan.");
  return t;
}

const message = z.string().trim().min(1, "Tulis pesannya.").max(2000, "Pesan terlalu panjang (maks. 2.000 huruf).");

export const helpCommands: Record<string, Handler> = {
  /** A signed-in person (staff or umat) sends a question, bug report, idea or abuse report. */
  async submitHelp(ctx, p) {
    const i = z
      .object({
        category: z.enum(["cara_pakai", "masalah", "usul", "penyalahgunaan", "lainnya"]),
        message: message.min(10, "Ceritakan sedikit lebih jelas (minimal 10 huruf)."),
        page: z.string().max(400).default("/"),
        screen: z.string().regex(/^\d{2,5}x\d{2,5}$/).optional(),
        image: z.string().max(Math.ceil(HELP_IMAGE_MAX_BYTES * 1.4)).optional().nullable(),
      })
      .parse(p);
    const img = i.image ? decodeImage(i.image, "Lampiran") : null;
    if (img && img.buf.length > HELP_IMAGE_MAX_BYTES) throw new ApiError(413, "Gambar lampiran terlalu besar.");
    try {
      await rateLimit(`help:${ctx.user.id}`, HELP_PER_HOUR, 60);
    } catch {
      throw new ApiError(429, `Anda sudah mengirim ${HELP_PER_HOUR} pesan dalam satu jam terakhir. Coba lagi nanti, atau tambahkan keterangan sebagai balasan di pesan sebelumnya.`);
    }
    const context = await contextOf(ctx, i.page, i.screen);
    const ticketId = uid("hp");
    await db.transaction(async (tx) => {
      let attachmentId: string | null = null;
      if (img) {
        attachmentId = uid("hpimg");
        await tx.insert(T.attachments).values({ id: attachmentId, templeId: null, mime: img.mime, data: img.buf, size: img.buf.length, isPublic: false, createdBy: ctx.user.id });
      }
      await tx.insert(T.helpTickets).values({ id: ticketId, userId: ctx.user.id, category: i.category, message: i.message, context, attachmentId });
      await log(ctx, tx, { action: "Mengirim pesan bantuan", entity: "help", entityId: ticketId, detail: HELP_CATEGORY_LABEL[i.category as HelpCategory], templeId: null });
    });
    await emailAdmins(ctx, "Pesan bantuan baru", `${HELP_CATEGORY_LABEL[i.category as HelpCategory]} — dari ${ctx.user.name}.`);
    return { id: ticketId };
  },

  async replyHelp(ctx, p) {
    const i = z.object({ ticketId: id, message }).parse(p);
    const t = await ticketFor(ctx, i.ticketId);
    const fromAdmin = ctx.user.isSuperAdmin && t.userId !== ctx.user.id;
    await rateLimit(`help-reply:${ctx.user.id}`, 30, 60);
    await db.transaction(async (tx) => {
      await tx.insert(T.helpReplies).values({ id: uid("hr"), ticketId: t.id, authorId: ctx.user.id, fromAdmin, message: i.message });
      if (fromAdmin) {
        await tx.update(T.helpTickets).set({ unreadByUser: true, unreadByAdmin: false, updatedAt: new Date(), status: t.status === "baru" ? "diproses" : t.status }).where(eq(T.helpTickets.id, t.id));
        await log(ctx, tx, { action: "Membalas pesan bantuan", entity: "help", entityId: t.id, detail: HELP_CATEGORY_LABEL[t.category as HelpCategory], templeId: null });
      } else {
        // The person adds something: Admin Utama sees it as unread again (a finished ticket reopens).
        await tx.update(T.helpTickets).set({ unreadByAdmin: true, updatedAt: new Date(), ...(t.status === "selesai" ? { status: "diproses", closedAt: null } : {}) }).where(eq(T.helpTickets.id, t.id));
      }
    });
    if (fromAdmin) await emailUser(ctx, t.userId);
    return null;
  },

  async setHelpStatus(ctx, p) {
    await requireSuperAdmin(ctx, "mengubah status pesan bantuan");
    const i = z.object({ ticketId: id, status: z.enum(["baru", "diproses", "selesai"]) }).parse(p);
    await db.transaction(async (tx) => {
      const t = await one(tx.select().from(T.helpTickets).where(eq(T.helpTickets.id, i.ticketId)).for("update"), "Pesan tidak ditemukan.");
      if (t.status === i.status) return;
      await tx.update(T.helpTickets).set({ status: i.status, updatedAt: new Date(), closedAt: i.status === "selesai" ? new Date() : null, unreadByAdmin: false }).where(eq(T.helpTickets.id, t.id));
      await log(ctx, tx, { action: "Mengubah status pesan bantuan", entity: "help", entityId: t.id, detail: HELP_CATEGORY_LABEL[t.category as HelpCategory], changes: { status: { dari: t.status, menjadi: i.status } }, templeId: null });
    });
    return null;
  },

  /** Marks a ticket as read — by its owner (replies) or by Admin Utama (the inbox badge). */
  async readHelp(ctx, p) {
    const i = z.object({ ticketId: id }).parse(p);
    const t = await ticketFor(ctx, i.ticketId);
    if (t.userId === ctx.user.id) await db.update(T.helpTickets).set({ unreadByUser: false }).where(eq(T.helpTickets.id, t.id));
    else await db.update(T.helpTickets).set({ unreadByAdmin: false }).where(eq(T.helpTickets.id, t.id));
    return null;
  },
};

/** Tickets with their replies: one person's own (Bantuan page) or all of them (Admin Utama inbox). */
export async function loadTickets(opts: { userId?: string }): Promise<HelpTicket[]> {
  const rows = await db
    .select({ t: T.helpTickets, u: { id: T.users.id, name: T.users.name, email: T.users.email } })
    .from(T.helpTickets)
    .innerJoin(T.users, eq(T.users.id, T.helpTickets.userId))
    .where(opts.userId ? eq(T.helpTickets.userId, opts.userId) : undefined)
    .orderBy(desc(T.helpTickets.updatedAt))
    .limit(300);
  const ids = rows.map((r) => r.t.id);
  const replies = ids.length
    ? await db.select({ r: T.helpReplies, name: T.users.name }).from(T.helpReplies).innerJoin(T.users, eq(T.users.id, T.helpReplies.authorId)).where(inArray(T.helpReplies.ticketId, ids)).orderBy(asc(T.helpReplies.createdAt))
    : [];
  return rows.map(({ t, u }) => ({
    id: t.id,
    category: t.category as HelpTicket["category"],
    message: t.message,
    status: t.status as HelpTicket["status"],
    context: t.context,
    attachment: t.attachmentId ? `/api/bantuan/lampiran/${t.id}` : undefined,
    attachmentRemovedAt: t.attachmentRemovedAt?.toISOString(),
    unreadByAdmin: t.unreadByAdmin,
    unreadByUser: t.unreadByUser,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    closedAt: t.closedAt?.toISOString(),
    // The person sees "Admin Utama"; the inbox shows who wrote each reply.
    replies: replies.filter((x) => x.r.ticketId === t.id).map((x) => ({ id: x.r.id, fromAdmin: x.r.fromAdmin, authorName: opts.userId && x.r.fromAdmin ? "Admin Utama" : x.name, message: x.r.message, createdAt: x.r.createdAt.toISOString() })),
    user: opts.userId ? undefined : u,
  }));
}

/** Deletes attached images of tickets finished more than HELP_ATTACHMENT_DAYS days ago. */
export async function cleanupHelpAttachments() {
  const old = await db
    .select({ id: T.helpTickets.id, attachmentId: T.helpTickets.attachmentId })
    .from(T.helpTickets)
    .where(and(eq(T.helpTickets.status, "selesai"), isNotNull(T.helpTickets.attachmentId), lt(T.helpTickets.closedAt, sql`now() - make_interval(days => ${HELP_ATTACHMENT_DAYS})`)));
  for (const t of old) {
    await db.transaction(async (tx) => {
      await tx.update(T.helpTickets).set({ attachmentId: null, attachmentRemovedAt: new Date() }).where(eq(T.helpTickets.id, t.id));
      await tx.delete(T.attachments).where(eq(T.attachments.id, t.attachmentId!));
    });
  }
  return old.length;
}

/** Unread counts for the badges: replies for the person, new messages for Admin Utama. */
export async function helpCounts(user: { id: string; isSuperAdmin: boolean }) {
  const [mine] = await db.select({ n: sql<number>`count(*)::int` }).from(T.helpTickets).where(and(eq(T.helpTickets.userId, user.id), eq(T.helpTickets.unreadByUser, true)));
  const inbox = user.isSuperAdmin ? (await db.select({ n: sql<number>`count(*)::int` }).from(T.helpTickets).where(eq(T.helpTickets.unreadByAdmin, true)))[0].n : 0;
  return { unread: mine.n, inbox };
}

export type { Row as HelpTicketRow };
