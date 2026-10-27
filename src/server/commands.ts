import "server-only";
import { z } from "zod";
import { and, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { db, schema, type Tx } from "./db";
import { ApiError, todayInAppTz } from "./http";
import { requirePerm, requireTemple, type Ctx } from "./context";
import { diff, logActivity } from "./log";
import { persistImage } from "./images";
import { createPasswordLink, hashPassword, originOf, passwordProblem, verifyPassword } from "./auth";
import * as m from "./map";
import { byCategory, campaignStats, summarize } from "@/lib/ledger";
import { categoriesFor } from "@/lib/seed";
import { rupiah, slugify, uid } from "@/lib/format";
import { MEMBER_ROLES, can } from "@/lib/permissions";
import type { AppNotification, DataState } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation building blocks
// ---------------------------------------------------------------------------
const id = z.string().min(1).max(64);
const optId = z.string().max(64).optional().nullable().transform((v) => v || null);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid");
const money = z.number().int().min(0).max(1_000_000_000_000);
const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);
const image = z.string().max(3_500_000).optional().nullable();
const memberRole = z.enum(MEMBER_ROLES);
const coverVariant = z.enum(["emerald", "dusk", "gold", "ocean", "forest"]);

const txInput = z.object({
  type: z.enum(["income", "expense", "transfer"]),
  amount: money.min(1, "Nominal harus lebih dari nol"),
  date: isoDate,
  categoryId: optId,
  description: text(200).min(3, "Keterangan terlalu pendek"),
  accountId: id,
  toAccountId: optId,
  activityId: optId,
  campaignId: optId,
  source: optText(120),
  receipt: image,
  receiptName: optText(120),
  notes: optText(500),
  status: z.enum(["draft", "confirmed"]),
});

const campaignInput = z.object({
  title: text(120).min(5),
  description: text(4000).min(20),
  cover: coverVariant,
  coverImage: image,
  activityId: optId,
  target: money.min(100_000),
  startDate: isoDate,
  endDate: isoDate,
  purpose: text(300).min(5),
  accountId: id,
  instructions: text(1000).min(10),
  manualVerification: z.boolean(),
  showDonorList: z.boolean(),
  defaultPrivacy: z.enum(["public", "anonymous", "private"]),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const T = schema;
const now = () => new Date();

function maxDate() {
  // Allow "today" in any Indonesian time zone (WIB–WIT).
  const d = new Date(todayInAppTz() + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function nextNumber(tx: Tx, templeId: string, date: string) {
  const [r] = await tx.update(T.temples).set({ txCounter: sql`${T.temples.txCounter} + 1` }).where(eq(T.temples.id, templeId)).returning({ n: T.temples.txCounter });
  return `TRX-${date.slice(0, 4)}-${String(r.n).padStart(4, "0")}`;
}

async function notify(tx: Tx, n: Omit<AppNotification, "id" | "date" | "read">) {
  await tx.insert(T.notifications).values({ id: uid("n"), templeId: n.templeId, kind: n.kind, title: n.title, body: n.body, href: n.href ?? null });
}

function log(ctx: Ctx, tx: Tx, e: { action: string; entity: string; detail: string; entityId?: string | null; changes?: unknown; templeId?: string | null }) {
  return logActivity({ ...e, actor: ctx.actor, templeId: e.templeId === undefined ? ctx.templeId : e.templeId, req: ctx.req }, tx);
}

async function one<R>(rows: Promise<R[]>, msg = "Data tidak ditemukan.") {
  const r = (await rows)[0];
  if (!r) throw new ApiError(404, msg);
  return r;
}

/** Validates that every referenced record belongs to the active temple. */
async function checkRefs(tx: Tx, templeId: string, i: z.infer<typeof txInput>) {
  const acc = await tx.select().from(T.accounts).where(and(eq(T.accounts.id, i.accountId), eq(T.accounts.templeId, templeId)));
  if (!acc[0]) throw new ApiError(400, "Kas/rekening tidak ditemukan.");
  if (i.type === "transfer") {
    if (!i.toAccountId) throw new ApiError(400, "Pilih rekening tujuan.");
    if (i.toAccountId === i.accountId) throw new ApiError(400, "Rekening asal dan tujuan tidak boleh sama.");
    const to = await tx.select().from(T.accounts).where(and(eq(T.accounts.id, i.toAccountId), eq(T.accounts.templeId, templeId)));
    if (!to[0]) throw new ApiError(400, "Rekening tujuan tidak ditemukan.");
  } else {
    if (!i.categoryId) throw new ApiError(400, "Pilih jenis/kategori.");
    const cat = await tx.select().from(T.categories).where(and(eq(T.categories.id, i.categoryId), eq(T.categories.templeId, templeId)));
    if (!cat[0] || cat[0].type !== i.type) throw new ApiError(400, "Kategori tidak sesuai.");
  }
  if (i.activityId) {
    const a = await tx.select().from(T.activities).where(and(eq(T.activities.id, i.activityId), eq(T.activities.templeId, templeId)));
    if (!a[0]) throw new ApiError(400, "Kegiatan tidak ditemukan.");
  }
  if (i.campaignId) {
    const c = await tx.select().from(T.campaigns).where(and(eq(T.campaigns.id, i.campaignId), eq(T.campaigns.templeId, templeId)));
    if (!c[0]) throw new ApiError(400, "Campaign tidak ditemukan.");
  }
  if (i.date > maxDate()) throw new ApiError(400, "Tanggal tidak boleh di masa depan.");
}

async function ledgerFor(tx: Tx, templeId: string): Pick<DataState, "transactions" | "accounts" | "categories"> extends infer R ? Promise<R> : never {
  const [txs, accs, cats] = await Promise.all([
    tx.select().from(T.transactions).where(eq(T.transactions.templeId, templeId)),
    tx.select().from(T.accounts).where(eq(T.accounts.templeId, templeId)),
    tx.select().from(T.categories).where(eq(T.categories.templeId, templeId)),
  ]);
  return { transactions: txs.map(m.toTx), accounts: accs.map(m.toAccount), categories: cats.map(m.toCategory) };
}

const typeLabel = (t: string) => (t === "income" ? "pemasukan" : t === "expense" ? "pengeluaran" : "pindah dana");

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
type Handler = (ctx: Ctx, payload: unknown) => Promise<unknown>;

export const commands: Record<string, Handler> = {
  async setActiveTemple(ctx, p) {
    const { templeId } = z.object({ templeId: id }).parse(p);
    if (!ctx.user.isSuperAdmin) {
      const mem = await db.select().from(T.memberships).where(and(eq(T.memberships.userId, ctx.user.id), eq(T.memberships.templeId, templeId), eq(T.memberships.status, "active")));
      if (!mem[0]) throw new ApiError(403, "Anda bukan pengurus pura ini.");
    }
    await db.update(T.sessions).set({ activeTempleId: templeId }).where(eq(T.sessions.id, ctx.session.id));
    ctx.templeId = templeId;
    ctx.role = ctx.user.isSuperAdmin ? "superadmin" : ((await db.select().from(T.memberships).where(and(eq(T.memberships.userId, ctx.user.id), eq(T.memberships.templeId, templeId))))[0]?.role as Ctx["role"]);
    return null;
  },

  async createTemple(ctx, p) {
    if (!ctx.user.isSuperAdmin && process.env.ALLOW_REGISTRATION !== "true")
      throw new ApiError(403, "Pendaftaran pura baru hanya dapat dilakukan oleh Admin Utama.");
    const i = z
      .object({
        name: text(120).min(4), description: text(600).min(20), province: text(80).min(2), regency: text(80).min(3), district: text(80).min(3),
        village: text(80).min(3), address: text(300).min(8), phone: z.string().regex(/^[0-9+\-\s]{8,16}$/), photo: image, role: memberRole,
      })
      .parse(p);
    const templeId = uid("t");
    return db.transaction(async (tx) => {
      let slug = slugify(i.name) || templeId;
      if ((await tx.select().from(T.temples).where(eq(T.temples.slug, slug)))[0]) slug = `${slug}-${templeId.slice(-4)}`;
      const photo = await persistImage(i.photo, { templeId, isPublic: true, userId: ctx.user.id }, tx);
      const [row] = await tx
        .insert(T.temples)
        .values({
          id: templeId, slug, name: i.name, province: i.province, regency: i.regency, district: i.district, village: i.village, address: i.address,
          description: i.description, phone: i.phone, photo, cover: "emerald",
          status: ctx.user.isSuperAdmin ? "active" : "pending",
          transparency: { showPublicProfile: true, showCampaigns: true, showPublishedSummaries: true, showDonorList: true, showBankAccount: true },
          branding: { headerTitle: `Laporan Keuangan ${i.name}`, signatoryName: ctx.user.name, signatoryRole: "Ketua Pengempon", footerNote: "Laporan ini disusun secara transparan untuk krama pengempon pura." },
        })
        .returning();
      if (!ctx.user.isSuperAdmin) await tx.insert(T.memberships).values({ id: uid("m"), userId: ctx.user.id, templeId, role: i.role, status: "active" });
      await tx.insert(T.accounts).values({ id: uid("acc"), templeId, name: "Kas Tunai Pura", type: "cash", openingBalance: 0, openingDate: todayInAppTz() });
      await tx.insert(T.categories).values(categoriesFor(templeId).map((c) => ({ ...c, archived: false })));
      const year = todayInAppTz().slice(0, 4);
      await tx.insert(T.activities).values({ id: uid("a"), templeId, name: "Operasional Pura", description: "Kebutuhan rutin pura.", startDate: `${year}-01-01`, endDate: `${year}-12-31`, budget: 0, fundType: "general", status: "ongoing", color: "#8A5CB8" });
      await notify(tx, { templeId, kind: "info", title: "Selamat datang di PURA!", body: "Ruang kerja pura Anda sudah siap. Mulai dengan mengisi saldo awal kas di Pengaturan → Kas & Rekening.", href: "/app/pengaturan?tab=rekening" });
      await log(ctx, tx, { action: "Mendaftarkan pura", entity: "settings", entityId: templeId, detail: `${i.name}${row.status === "pending" ? " (menunggu persetujuan Admin Utama)" : ""}`, templeId });
      await tx.update(T.sessions).set({ activeTempleId: templeId }).where(eq(T.sessions.id, ctx.session.id));
      ctx.templeId = templeId;
      ctx.role = ctx.user.isSuperAdmin ? "superadmin" : i.role;
      return m.toTemple(row);
    });
  },

  // ---- Ledger -------------------------------------------------------------
  async addTransaction(ctx, p) {
    const templeId = requireTemple(ctx);
    const { input, key } = z.object({ input: txInput, key: z.string().min(8).max(80) }).parse(p);
    await requirePerm(ctx, input.status === "draft" ? "tx.draft" : "tx.create", "mencatat transaksi");
    return db.transaction(async (tx) => {
      const existing = await tx.select().from(T.transactions).where(and(eq(T.transactions.templeId, templeId), eq(T.transactions.idempotencyKey, key)));
      if (existing[0]) return m.toTx(existing[0]); // double submit — return the original
      await checkRefs(tx, templeId, input);
      const txId = uid("tx");
      const receipt = await persistImage(input.receipt, { templeId, isPublic: false, userId: ctx.user.id }, tx);
      const [row] = await tx
        .insert(T.transactions)
        .values({
          ...input, receipt, id: txId, number: await nextNumber(tx, templeId, input.date), templeId,
          categoryId: input.type === "transfer" ? null : input.categoryId, toAccountId: input.type === "transfer" ? input.toAccountId : null,
          createdBy: ctx.user.id, idempotencyKey: key,
        })
        .returning();
      await log(ctx, tx, {
        action: input.status === "draft" ? `Membuat draf ${typeLabel(input.type)}` : `Mencatat ${typeLabel(input.type)}`,
        entity: "transaction", entityId: txId, detail: `${row.number} · ${input.description} — ${rupiah(input.amount)}`,
        changes: { nominal: input.amount, tanggal: input.date, status: input.status },
      });
      if (input.status === "draft")
        await notify(tx, { templeId, kind: "tx_approval", title: "Transaksi menunggu persetujuan", body: `Draf "${input.description}" ${rupiah(input.amount)} perlu dikonfirmasi.`, href: `/app/transaksi/${txId}` });
      return m.toTx(row);
    });
  },

  async updateDraft(ctx, p) {
    const templeId = requireTemple(ctx);
    const { id: txId, patch } = z.object({ id, patch: txInput.partial() }).parse(p);
    if (!(await canWriteTx(ctx))) await requirePerm(ctx, "tx.draft", "mengubah draf");
    return db.transaction(async (tx) => {
      const cur = await one(tx.select().from(T.transactions).where(and(eq(T.transactions.id, txId), eq(T.transactions.templeId, templeId))).for("update"));
      if (cur.status !== "draft") throw new ApiError(409, "Transaksi yang sudah dikonfirmasi tidak dapat diubah. Gunakan koreksi.");
      const next = { ...m.toTx(cur), ...patch } as z.infer<typeof txInput>;
      next.status = "draft";
      await checkRefs(tx, templeId, { ...next, categoryId: next.categoryId ?? null, toAccountId: next.toAccountId ?? null } as z.infer<typeof txInput>);
      const receipt = patch.receipt !== undefined ? await persistImage(patch.receipt, { templeId, isPublic: false, userId: ctx.user.id }, tx) : cur.receipt;
      const values = { ...patch, receipt, status: "draft", updatedAt: now() };
      await tx.update(T.transactions).set(values).where(eq(T.transactions.id, txId));
      await log(ctx, tx, { action: "Mengubah draf transaksi", entity: "transaction", entityId: txId, detail: `${cur.number} · ${next.description}`, changes: diff(cur, { ...patch, receipt }, ["amount", "date", "categoryId", "description", "accountId", "toAccountId", "activityId", "source", "notes", "receipt"]) });
      return null;
    });
  },

  async confirmDraft(ctx, p) {
    const templeId = requireTemple(ctx);
    const { id: txId } = z.object({ id }).parse(p);
    await requirePerm(ctx, "tx.confirm", "mengonfirmasi transaksi");
    return db.transaction(async (tx) => {
      const cur = await one(tx.select().from(T.transactions).where(and(eq(T.transactions.id, txId), eq(T.transactions.templeId, templeId))).for("update"));
      if (cur.status !== "draft") throw new ApiError(409, "Draf tidak ditemukan.");
      await tx.update(T.transactions).set({ status: "confirmed", updatedAt: now() }).where(eq(T.transactions.id, txId));
      await log(ctx, tx, { action: "Mengonfirmasi transaksi", entity: "transaction", entityId: txId, detail: `${cur.number} · ${cur.description} — ${rupiah(cur.amount)}` });
      return null;
    });
  },

  async deleteDraft(ctx, p) {
    const templeId = requireTemple(ctx);
    const { id: txId } = z.object({ id }).parse(p);
    if (!(await canWriteTx(ctx))) await requirePerm(ctx, "tx.draft", "menghapus draf");
    return db.transaction(async (tx) => {
      const cur = await one(tx.select().from(T.transactions).where(and(eq(T.transactions.id, txId), eq(T.transactions.templeId, templeId))).for("update"));
      if (cur.status !== "draft") throw new ApiError(409, "Transaksi terkonfirmasi tidak boleh dihapus.");
      await tx.delete(T.transactions).where(eq(T.transactions.id, txId));
      await log(ctx, tx, { action: "Menghapus draf transaksi", entity: "transaction", entityId: txId, detail: `${cur.number} · ${cur.description} — ${rupiah(cur.amount)}`, changes: { dihapus: m.toTx(cur) } });
      return null;
    });
  },

  async reverseTransaction(ctx, p) {
    const templeId = requireTemple(ctx);
    const { id: txId, reason } = z.object({ id, reason: text(300).min(5, "Tuliskan alasan koreksi") }).parse(p);
    await requirePerm(ctx, "tx.reverse", "membuat koreksi");
    return db.transaction(async (tx) => {
      const cur = await one(tx.select().from(T.transactions).where(and(eq(T.transactions.id, txId), eq(T.transactions.templeId, templeId))).for("update"));
      if (cur.status !== "confirmed") throw new ApiError(409, "Hanya transaksi terkonfirmasi yang dapat dikoreksi.");
      if (cur.reversedBy) throw new ApiError(409, "Transaksi ini sudah pernah dikoreksi.");
      if (cur.reversalOf) throw new ApiError(409, "Entri koreksi tidak dapat dikoreksi lagi.");
      if (cur.donationId) throw new ApiError(409, "Transaksi dari donasi terverifikasi dikoreksi lewat halaman campaign.");
      const today = todayInAppTz();
      const revId = uid("tx");
      const [rev] = await tx
        .insert(T.transactions)
        .values({
          ...cur, id: revId, number: await nextNumber(tx, templeId, today), date: today, description: `Koreksi: ${cur.description}`.slice(0, 200),
          notes: reason, reversalOf: cur.id, reversedBy: null, receipt: null, receiptName: null, status: "confirmed",
          createdBy: ctx.user.id, createdAt: now(), updatedAt: now(), idempotencyKey: `reverse:${cur.id}`,
        })
        .returning();
      await tx.update(T.transactions).set({ reversedBy: revId, updatedAt: now() }).where(eq(T.transactions.id, txId));
      await log(ctx, tx, { action: "Membuat koreksi (pembatalan transaksi)", entity: "transaction", entityId: revId, detail: `Membatalkan ${cur.number} "${cur.description}" ${rupiah(cur.amount)}. Alasan: ${reason}` });
      return m.toTx(rev);
    });
  },

  // ---- Activities --------------------------------------------------------
  async saveActivity(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "activity.manage", "mengelola kegiatan");
    const i = z
      .object({
        id: optId, name: text(120).min(3), description: text(400), startDate: isoDate, endDate: isoDate, budget: money,
        fundType: z.enum(["general", "restricted"]), status: z.enum(["planned", "ongoing", "done"]), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      })
      .parse(p);
    if (i.endDate < i.startDate) throw new ApiError(400, "Tanggal selesai harus setelah tanggal mulai.");
    return db.transaction(async (tx) => {
      const { id: aid, ...values } = i;
      if (aid) {
        const cur = await one(tx.select().from(T.activities).where(and(eq(T.activities.id, aid), eq(T.activities.templeId, templeId))));
        const [row] = await tx.update(T.activities).set(values).where(eq(T.activities.id, aid)).returning();
        await log(ctx, tx, { action: "Mengubah kegiatan", entity: "activity", entityId: aid, detail: row.name, changes: diff(cur, values, Object.keys(values)) });
        return m.toActivity(row);
      }
      const [row] = await tx.insert(T.activities).values({ ...values, id: uid("a"), templeId }).returning();
      await log(ctx, tx, { action: "Membuat kegiatan", entity: "activity", entityId: row.id, detail: row.name });
      return m.toActivity(row);
    });
  },

  // ---- Campaigns ---------------------------------------------------------
  async saveCampaign(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "campaign.manage", "mengelola campaign");
    const { input, status, id: cid } = z.object({ input: campaignInput, status: z.enum(["draft", "active"]), id: optId }).parse(p);
    if (input.endDate <= input.startDate) throw new ApiError(400, "Tanggal berakhir harus setelah tanggal mulai.");
    return db.transaction(async (tx) => {
      const acc = await tx.select().from(T.accounts).where(and(eq(T.accounts.id, input.accountId), eq(T.accounts.templeId, templeId)));
      if (!acc[0]) throw new ApiError(400, "Rekening tidak ditemukan.");
      const coverImage = await persistImage(input.coverImage, { templeId, isPublic: true, userId: ctx.user.id }, tx);
      const values = { ...input, coverImage, status };
      if (cid) {
        const cur = await one(tx.select().from(T.campaigns).where(and(eq(T.campaigns.id, cid), eq(T.campaigns.templeId, templeId))));
        const [row] = await tx.update(T.campaigns).set({ ...values, publishedAt: status === "active" && !cur.publishedAt ? now() : cur.publishedAt }).where(eq(T.campaigns.id, cid)).returning();
        await log(ctx, tx, { action: status === "active" ? "Mempublikasikan campaign" : "Mengubah campaign", entity: "campaign", entityId: cid, detail: row.title, changes: diff(cur, values, ["title", "target", "startDate", "endDate", "accountId", "status"]) });
        return m.toCampaign(row);
      }
      const newId = uid("cp");
      let slug = slugify(input.title) || newId;
      if ((await tx.select().from(T.campaigns).where(eq(T.campaigns.slug, slug)))[0]) slug = `${slug}-${newId.slice(-4)}`;
      const [row] = await tx
        .insert(T.campaigns)
        .values({
          ...values, id: newId, slug, templeId, publishedAt: status === "active" ? now() : null,
          updates: status === "active" ? [{ id: uid("up"), date: todayInAppTz(), title: "Penggalangan dana dibuka", body: "Om Swastyastu. Penggalangan dana resmi dibuka. Suksma atas dukungan krama." }] : [],
        })
        .returning();
      await log(ctx, tx, { action: status === "active" ? "Membuat & mempublikasikan campaign" : "Membuat draf campaign", entity: "campaign", entityId: newId, detail: row.title });
      return m.toCampaign(row);
    });
  },

  async setCampaignStatus(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "campaign.manage", "mengelola campaign");
    const { id: cid, status } = z.object({ id, status: z.enum(["draft", "active", "completed"]) }).parse(p);
    return db.transaction(async (tx) => {
      const cur = await one(tx.select().from(T.campaigns).where(and(eq(T.campaigns.id, cid), eq(T.campaigns.templeId, templeId))));
      await tx.update(T.campaigns).set({ status, publishedAt: status === "active" && !cur.publishedAt ? now() : cur.publishedAt }).where(eq(T.campaigns.id, cid));
      await log(ctx, tx, { action: status === "completed" ? "Menutup campaign" : status === "active" ? "Mempublikasikan campaign" : "Menjadikan draf", entity: "campaign", entityId: cid, detail: cur.title });
      return null;
    });
  },

  async addCampaignUpdate(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "campaign.manage", "menambah kabar campaign");
    const { campaignId, u } = z.object({ campaignId: id, u: z.object({ date: isoDate, title: text(120).min(3), body: text(2000).min(5) }) }).parse(p);
    return db.transaction(async (tx) => {
      const cur = await one(tx.select().from(T.campaigns).where(and(eq(T.campaigns.id, campaignId), eq(T.campaigns.templeId, templeId))).for("update"));
      await tx.update(T.campaigns).set({ updates: [{ ...u, id: uid("up") }, ...(cur.updates ?? [])] }).where(eq(T.campaigns.id, campaignId));
      await log(ctx, tx, { action: "Menambah kabar campaign", entity: "campaign", entityId: campaignId, detail: u.title });
      return null;
    });
  },

  // ---- Donations ---------------------------------------------------------
  async addDonation(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "donation.manage", "mencatat donasi");
    const i = z
      .object({
        campaignId: id, donorName: text(80), amount: money.min(1000), date: isoDate, privacy: z.enum(["public", "anonymous", "private"]),
        message: optText(300), evidence: image, channel: z.enum(["transfer", "tunai"]), verifyNow: z.boolean().optional(),
      })
      .parse(p);
    if (i.date > maxDate()) throw new ApiError(400, "Tanggal tidak boleh di masa depan.");
    const created = await db.transaction(async (tx) => {
      const c = await one(tx.select().from(T.campaigns).where(and(eq(T.campaigns.id, i.campaignId), eq(T.campaigns.templeId, templeId))), "Campaign tidak ditemukan.");
      const evidence = await persistImage(i.evidence, { templeId, isPublic: false, userId: ctx.user.id }, tx);
      const [row] = await tx
        .insert(T.donations)
        .values({ id: uid("dn"), templeId, campaignId: c.id, donorName: i.donorName || "Anonim", amount: i.amount, date: i.date, privacy: i.privacy, status: "pending", message: i.message, evidence, channel: i.channel })
        .returning();
      await log(ctx, tx, { action: "Mencatat donasi", entity: "donation", entityId: row.id, detail: `${row.donorName} — ${rupiah(row.amount)} (${c.title})` });
      return row;
    });
    if (i.verifyNow) await commands.verifyDonation(ctx, { id: created.id });
    return m.toDonation(created);
  },

  async verifyDonation(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "donation.manage", "memverifikasi donasi");
    const { id: did } = z.object({ id }).parse(p);
    return db.transaction(async (tx) => {
      const dn = await one(tx.select().from(T.donations).where(and(eq(T.donations.id, did), eq(T.donations.templeId, templeId))).for("update"), "Donasi tidak ditemukan.");
      const linked = await tx.select().from(T.transactions).where(and(eq(T.transactions.donationId, did), isNull(T.transactions.reversalOf)));
      if (dn.status === "verified" && linked[0]) return m.toTx(linked[0]); // idempotent
      if (dn.status === "rejected") throw new ApiError(409, "Donasi yang ditolak tidak dapat diverifikasi.");
      const c = await one(tx.select().from(T.campaigns).where(eq(T.campaigns.id, dn.campaignId)));
      const before = await tx.select().from(T.donations).where(eq(T.donations.campaignId, c.id));
      const cat = (await tx.select().from(T.categories).where(and(eq(T.categories.templeId, templeId), eq(T.categories.name, "Donasi Penggalangan Dana"))))[0]
        ?? (await tx.select().from(T.categories).where(and(eq(T.categories.templeId, templeId), eq(T.categories.type, "income"))))[0];
      let row = linked[0];
      if (!row) {
        [row] = await tx
          .insert(T.transactions)
          .values({
            id: uid("tx"), number: await nextNumber(tx, templeId, dn.date), templeId, type: "income", amount: dn.amount, date: dn.date, categoryId: cat?.id ?? null,
            description: `Dana punia: ${dn.privacy === "public" ? dn.donorName : "Donatur"}`, accountId: c.accountId, activityId: c.activityId, campaignId: c.id,
            donationId: did, source: dn.donorName, receipt: dn.evidence, status: "confirmed", createdBy: ctx.user.id, idempotencyKey: `donation:${did}`,
          })
          .returning();
      }
      await tx.update(T.donations).set({ status: "verified", transactionId: row.id, verifiedAt: now(), verifiedBy: ctx.user.id }).where(eq(T.donations.id, did));
      await tx.update(T.notifications).set({ read: true }).where(and(eq(T.notifications.templeId, templeId), eq(T.notifications.kind, "donation_pending"), sql`${T.notifications.body} like ${"%" + dn.donorName + "%"}`));
      await log(ctx, tx, { action: "Memverifikasi donasi", entity: "donation", entityId: did, detail: `${dn.donorName} — ${rupiah(dn.amount)} (${c.title}). Tercatat sebagai ${row.number}.` });
      const camp = m.toCampaign(c);
      const prev = campaignStats(camp, before.map(m.toDonation)).collected;
      if (prev < c.target && prev + dn.amount >= c.target)
        await notify(tx, { templeId, kind: "target_reached", title: "Target campaign tercapai 🎉", body: `${c.title} telah mencapai target ${rupiah(c.target)}.`, href: `/app/campaign/${c.id}` });
      return m.toTx(row);
    });
  },

  async rejectDonation(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "donation.manage", "menolak donasi");
    const { id: did, reason } = z.object({ id, reason: text(300).min(5) }).parse(p);
    return db.transaction(async (tx) => {
      const dn = await one(tx.select().from(T.donations).where(and(eq(T.donations.id, did), eq(T.donations.templeId, templeId))).for("update"));
      if (dn.status !== "pending") throw new ApiError(409, "Hanya donasi menunggu yang dapat ditolak.");
      await tx.update(T.donations).set({ status: "rejected", rejectedReason: reason }).where(eq(T.donations.id, did));
      await log(ctx, tx, { action: "Menolak donasi", entity: "donation", entityId: did, detail: `${dn.donorName} — ${rupiah(dn.amount)}: ${reason}` });
      return null;
    });
  },

  // ---- Reports -----------------------------------------------------------
  async publishReport(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "report.publish", "mempublikasikan laporan");
    const i = z.object({ title: text(160).min(5), from: isoDate, to: isoDate, note: optText(500) }).parse(p);
    if (i.from > i.to) throw new ApiError(400, "Periode tidak valid.");
    return db.transaction(async (tx) => {
      const L = await ledgerFor(tx, templeId);
      const s = summarize(L, templeId, { from: i.from, to: i.to });
      const inRange = L.transactions.filter((t) => t.date >= i.from && t.date <= i.to);
      const [row] = await tx
        .insert(T.reports)
        .values({
          id: uid("rp"), templeId, title: i.title, periodStart: i.from, periodEnd: i.to, publishedBy: ctx.user.id,
          snapshot: {
            openingBalance: s.openingBalance, income: s.income, expense: s.expense, closingBalance: s.closingBalance,
            incomeByCategory: byCategory(inRange, L.categories, "income").map(({ name, amount }) => ({ name, amount })),
            expenseByCategory: byCategory(inRange, L.categories, "expense").map(({ name, amount }) => ({ name, amount })),
            note: i.note ?? undefined,
          },
        })
        .returning();
      await log(ctx, tx, { action: "Mempublikasikan laporan", entity: "report", entityId: row.id, detail: i.title });
      await notify(tx, { templeId, kind: "report_ready", title: "Laporan dipublikasikan", body: `${i.title} kini tampil di halaman publik pura.`, href: "/app/laporan" });
      return m.toReport(row);
    });
  },

  async unpublishReport(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "report.publish", "menarik laporan");
    const { id: rid } = z.object({ id }).parse(p);
    return db.transaction(async (tx) => {
      const r = await one(tx.select().from(T.reports).where(and(eq(T.reports.id, rid), eq(T.reports.templeId, templeId))));
      await tx.delete(T.reports).where(eq(T.reports.id, rid));
      await log(ctx, tx, { action: "Menarik laporan publik", entity: "report", entityId: rid, detail: r.title });
      return null;
    });
  },

  // ---- Notifications -----------------------------------------------------
  async markNotificationRead(ctx, p) {
    const templeId = requireTemple(ctx);
    const { id: nid } = z.object({ id }).parse(p);
    await db.update(T.notifications).set({ read: true }).where(and(eq(T.notifications.id, nid), eq(T.notifications.templeId, templeId)));
    return null;
  },
  async markAllNotificationsRead(ctx) {
    const templeId = requireTemple(ctx);
    await db.update(T.notifications).set({ read: true }).where(eq(T.notifications.templeId, templeId));
    return null;
  },

  // ---- Settings ----------------------------------------------------------
  async updateTemple(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "settings.manage", "mengubah pengaturan pura");
    const i = z
      .object({
        name: text(120).min(4), description: text(600), province: text(80), regency: text(80), district: text(80), village: text(80),
        address: text(300), phone: text(20), email: optText(120), cover: coverVariant, photo: image, established: optText(20),
        transparency: z.object({ showPublicProfile: z.boolean(), showCampaigns: z.boolean(), showPublishedSummaries: z.boolean(), showDonorList: z.boolean(), showBankAccount: z.boolean() }),
        branding: z.object({ headerTitle: text(160), signatoryName: text(120), signatoryRole: text(80), footerNote: text(200) }),
      })
      .partial()
      .parse(p);
    return db.transaction(async (tx) => {
      const cur = await one(tx.select().from(T.temples).where(eq(T.temples.id, templeId)));
      const values: Record<string, unknown> = { ...i };
      if (i.photo !== undefined) values.photo = await persistImage(i.photo, { templeId, isPublic: true, userId: ctx.user.id }, tx);
      await tx.update(T.temples).set(values).where(eq(T.temples.id, templeId));
      await log(ctx, tx, { action: "Mengubah pengaturan pura", entity: "settings", entityId: templeId, detail: cur.name, changes: diff(cur, values, Object.keys(values)) });
      return null;
    });
  },

  async updateUser(ctx, p) {
    const i = z.object({ name: text(120).min(3), callName: text(60).min(2), phone: optText(20) }).partial().parse(p);
    await db.transaction(async (tx) => {
      await tx.update(T.users).set(i).where(eq(T.users.id, ctx.user.id));
      await log(ctx, tx, { action: "Mengubah profil sendiri", entity: "user", entityId: ctx.user.id, detail: ctx.user.name, changes: diff(ctx.user, i, Object.keys(i)), templeId: null });
    });
    return null;
  },

  async changePassword(ctx, p) {
    const { current, next } = z.object({ current: z.string().max(200), next: z.string().max(200) }).parse(p);
    if (!(await verifyPassword(current, ctx.user.passwordHash))) throw new ApiError(400, "Kata sandi lama salah.");
    const problem = passwordProblem(next, ctx.user.email);
    if (problem) throw new ApiError(400, problem);
    const hash = await hashPassword(next);
    await db.transaction(async (tx) => {
      await tx.update(T.users).set({ passwordHash: hash }).where(eq(T.users.id, ctx.user.id));
      // Sign out every other device.
      await tx.delete(T.sessions).where(and(eq(T.sessions.userId, ctx.user.id), ne(T.sessions.id, ctx.session.id)));
      await log(ctx, tx, { action: "Mengganti kata sandi", entity: "session", entityId: ctx.user.id, detail: "Kata sandi diganti; sesi di perangkat lain diakhiri.", templeId: null });
    });
    return null;
  },

  async saveAccount(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "settings.manage", "mengelola kas/rekening");
    const i = z
      .object({
        id: optId, name: text(80).min(3), type: z.enum(["cash", "bank"]), bankName: optText(80), accountNumber: optText(40), accountHolder: optText(120),
        openingBalance: money, openingDate: isoDate, isPublic: z.boolean().optional(), archived: z.boolean().optional(),
      })
      .parse(p);
    return db.transaction(async (tx) => {
      const { id: aid, ...values } = i;
      if (aid) {
        const cur = await one(tx.select().from(T.accounts).where(and(eq(T.accounts.id, aid), eq(T.accounts.templeId, templeId))));
        const used = await tx.select({ id: T.transactions.id }).from(T.transactions).where(and(eq(T.transactions.templeId, templeId), or(eq(T.transactions.accountId, aid), eq(T.transactions.toAccountId, aid)))).limit(1);
        if (used[0] && (values.openingBalance !== cur.openingBalance || values.openingDate !== cur.openingDate || values.type !== cur.type))
          throw new ApiError(409, "Saldo awal dan jenis rekening terkunci karena sudah ada transaksi.");
        await tx.update(T.accounts).set(values).where(eq(T.accounts.id, aid));
        await log(ctx, tx, { action: "Mengubah kas/rekening", entity: "settings", entityId: aid, detail: values.name, changes: diff(cur, values, Object.keys(values)) });
      } else {
        const newId = uid("acc");
        await tx.insert(T.accounts).values({ ...values, id: newId, templeId, isPublic: values.isPublic ?? false, archived: false });
        await log(ctx, tx, { action: "Menambah kas/rekening", entity: "settings", entityId: newId, detail: `${values.name} (saldo awal ${rupiah(values.openingBalance)})` });
      }
      return null;
    });
  },

  async saveCategory(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "settings.manage", "mengelola kategori");
    const i = z.object({ id: optId, name: text(80).min(3), type: z.enum(["income", "expense"]), icon: text(40), archived: z.boolean().optional() }).parse(p);
    return db.transaction(async (tx) => {
      const { id: cid, ...values } = i;
      if (cid) {
        await one(tx.select().from(T.categories).where(and(eq(T.categories.id, cid), eq(T.categories.templeId, templeId))));
        await tx.update(T.categories).set(values).where(eq(T.categories.id, cid));
      } else await tx.insert(T.categories).values({ ...values, id: uid("c"), templeId, archived: false });
      await log(ctx, tx, { action: cid ? "Mengubah kategori" : "Menambah kategori", entity: "settings", entityId: cid, detail: values.name });
      return null;
    });
  },

  // ---- Temple members (Ketua or Admin Utama) -----------------------------
  async inviteMember(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "users.manage", "mengundang pengurus");
    const i = z.object({ name: text(120).min(3), email: z.string().trim().toLowerCase().email(), role: memberRole }).parse(p);
    return addPerson(ctx, { ...i, templeId });
  },

  async changeMemberRole(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "users.manage", "mengubah peran");
    const { membershipId, role } = z.object({ membershipId: id, role: memberRole }).parse(p);
    return db.transaction(async (tx) => {
      const mem = await one(tx.select().from(T.memberships).where(and(eq(T.memberships.id, membershipId), eq(T.memberships.templeId, templeId))));
      if (mem.userId === ctx.user.id && !ctx.user.isSuperAdmin) throw new ApiError(409, "Anda tidak dapat mengubah peran Anda sendiri.");
      await ensureKetuaRemains(tx, templeId, membershipId, role);
      await tx.update(T.memberships).set({ role }).where(eq(T.memberships.id, membershipId));
      const u = await one(tx.select().from(T.users).where(eq(T.users.id, mem.userId)));
      await log(ctx, tx, { action: "Mengubah peran", entity: "user", entityId: u.id, detail: `${u.name}: ${mem.role} → ${role}`, changes: { peran: { dari: mem.role, menjadi: role } } });
      return null;
    });
  },

  async removeMember(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "users.manage", "mencabut akses pengurus");
    const { membershipId } = z.object({ membershipId: id }).parse(p);
    return db.transaction(async (tx) => {
      const mem = await one(tx.select().from(T.memberships).where(and(eq(T.memberships.id, membershipId), eq(T.memberships.templeId, templeId))));
      if (mem.userId === ctx.user.id) throw new ApiError(409, "Anda tidak dapat mencabut akses Anda sendiri.");
      await ensureKetuaRemains(tx, templeId, membershipId, null);
      await tx.delete(T.memberships).where(eq(T.memberships.id, membershipId));
      const u = await one(tx.select().from(T.users).where(eq(T.users.id, mem.userId)));
      await log(ctx, tx, { action: "Mencabut akses pengurus", entity: "user", entityId: u.id, detail: `${u.name} (${mem.role})` });
      return null;
    });
  },

  // ---- Admin Utama only --------------------------------------------------
  async setTempleStatus(ctx, p) {
    await requirePerm(ctx, "admin.manage", "menyetujui pendaftaran pura");
    const { templeId, status } = z.object({ templeId: id, status: z.enum(["active", "pending", "rejected"]) }).parse(p);
    return db.transaction(async (tx) => {
      const t = await one(tx.select().from(T.temples).where(eq(T.temples.id, templeId)));
      await tx.update(T.temples).set({ status }).where(eq(T.temples.id, templeId));
      await log(ctx, tx, { action: status === "active" ? "Menyetujui pura" : status === "rejected" ? "Menolak pura" : "Menangguhkan pura", entity: "settings", entityId: templeId, detail: t.name, templeId });
      return null;
    });
  },

  async adminCreateUser(ctx, p) {
    await requirePerm(ctx, "admin.manage", "menambah pengguna");
    const i = z.object({ name: text(120).min(3), email: z.string().trim().toLowerCase().email(), templeId: optId, role: memberRole.optional() }).parse(p);
    return addPerson(ctx, i);
  },

  async adminSetUserStatus(ctx, p) {
    await requirePerm(ctx, "admin.manage", "menonaktifkan pengguna");
    const { userId, status } = z.object({ userId: id, status: z.enum(["active", "disabled"]) }).parse(p);
    return db.transaction(async (tx) => {
      const u = await one(tx.select().from(T.users).where(eq(T.users.id, userId)));
      if (u.isSuperAdmin) throw new ApiError(409, "Akun Admin Utama tidak dapat dinonaktifkan.");
      await tx.update(T.users).set({ status }).where(eq(T.users.id, userId));
      if (status === "disabled") await tx.delete(T.sessions).where(eq(T.sessions.userId, userId));
      await log(ctx, tx, { action: status === "disabled" ? "Menonaktifkan pengguna" : "Mengaktifkan kembali pengguna", entity: "user", entityId: userId, detail: `${u.name} (${u.email})`, templeId: null });
      return null;
    });
  },

  async adminSetMembership(ctx, p) {
    await requirePerm(ctx, "admin.manage", "mengatur peran pengguna");
    const { userId, templeId, role } = z.object({ userId: id, templeId: id, role: memberRole.nullable() }).parse(p);
    return db.transaction(async (tx) => {
      const u = await one(tx.select().from(T.users).where(eq(T.users.id, userId)));
      if (u.isSuperAdmin) throw new ApiError(409, "Peran Admin Utama tidak dapat diubah.");
      const t = await one(tx.select().from(T.temples).where(eq(T.temples.id, templeId)));
      const cur = (await tx.select().from(T.memberships).where(and(eq(T.memberships.userId, userId), eq(T.memberships.templeId, templeId))))[0];
      if (cur) await ensureKetuaRemains(tx, templeId, cur.id, role);
      if (!role) {
        if (cur) await tx.delete(T.memberships).where(eq(T.memberships.id, cur.id));
      } else if (cur) await tx.update(T.memberships).set({ role }).where(eq(T.memberships.id, cur.id));
      else await tx.insert(T.memberships).values({ id: uid("m"), userId, templeId, role, status: u.passwordHash ? "active" : "invited" });
      await log(ctx, tx, { action: role ? "Mengatur peran pengguna" : "Mencabut akses pengguna", entity: "user", entityId: userId, detail: `${u.name} di ${t.name}: ${cur?.role ?? "—"} → ${role ?? "tanpa akses"}`, templeId });
      return null;
    });
  },

  async adminResetLink(ctx, p) {
    await requirePerm(ctx, "admin.manage", "membuat tautan atur ulang sandi");
    const { userId } = z.object({ userId: id }).parse(p);
    const u = await one(db.select().from(T.users).where(eq(T.users.id, userId)));
    if (u.isSuperAdmin && u.id !== ctx.user.id) throw new ApiError(409, "Tidak diizinkan.");
    const r = await createPasswordLink(u.id, u.passwordHash ? "reset" : "activation", ctx.user.id, originOf(ctx.req));
    await db.update(T.users).set({ resetRequestedAt: null }).where(eq(T.users.id, u.id));
    await logActivity({ actor: ctx.actor, action: "Membuat tautan atur ulang sandi", entity: "user", entityId: u.id, detail: `${u.name} (${u.email}), berlaku ${r.hours} jam`, req: ctx.req });
    return r;
  },
};

async function canWriteTx(ctx: Ctx) {
  return can(ctx.role, "tx.create");
}

async function ensureKetuaRemains(tx: Tx, templeId: string, membershipId: string, newRole: string | null) {
  if (newRole === "ketua") return;
  const mem = (await tx.select().from(T.memberships).where(eq(T.memberships.id, membershipId)))[0];
  if (mem?.role !== "ketua") return;
  const others = await tx.select().from(T.memberships).where(and(eq(T.memberships.templeId, templeId), eq(T.memberships.role, "ketua"), ne(T.memberships.id, membershipId)));
  if (!others.length) throw new ApiError(409, "Pura harus memiliki minimal satu Ketua.");
}

/** Creates (or reuses) a user account, optionally adds a temple role, and returns an activation link if needed. */
async function addPerson(ctx: Ctx, i: { name: string; email: string; templeId?: string | null; role?: (typeof MEMBER_ROLES)[number] }) {
  const result = await db.transaction(async (tx) => {
    let u = (await tx.select().from(T.users).where(eq(T.users.email, i.email)))[0];
    if (u?.isSuperAdmin) throw new ApiError(409, "Email ini milik Admin Utama.");
    if (!u) {
      const parts = i.name.trim().split(/\s+/);
      [u] = await tx
        .insert(T.users)
        .values({ id: uid("u"), name: i.name, callName: parts[parts.length - 1], email: i.email, avatarColor: ["#087F6D", "#C9A86A", "#3F6FB5", "#8A5CB8", "#B5543F"][Math.floor(Math.random() * 5)] })
        .returning();
      await log(ctx, tx, { action: "Menambah pengguna", entity: "user", entityId: u.id, detail: `${u.name} (${u.email})`, templeId: i.templeId ?? null });
    }
    if (i.templeId && i.role) {
      await one(tx.select().from(T.temples).where(eq(T.temples.id, i.templeId)), "Pura tidak ditemukan.");
      const exists = (await tx.select().from(T.memberships).where(and(eq(T.memberships.userId, u.id), eq(T.memberships.templeId, i.templeId))))[0];
      if (exists) throw new ApiError(409, "Pengguna ini sudah menjadi pengurus pura tersebut.");
      await tx.insert(T.memberships).values({ id: uid("m"), userId: u.id, templeId: i.templeId, role: i.role, status: u.passwordHash ? "active" : "invited" });
      await log(ctx, tx, { action: "Memberi peran pengurus", entity: "user", entityId: u.id, detail: `${u.name} sebagai ${i.role}`, templeId: i.templeId });
    }
    return u;
  });
  if (result.passwordHash) return { link: null, existing: true };
  const r = await createPasswordLink(result.id, "activation", ctx.user.id, originOf(ctx.req));
  return { link: r.link, hours: r.hours, existing: false };
}

/** Removes expired sessions and old rate-limit rows. Cheap; called occasionally. */
export async function housekeeping() {
  await db.delete(T.sessions).where(sql`${T.sessions.expiresAt} < now()`);
  await db.delete(T.rateLimits).where(sql`${T.rateLimits.at} < now() - interval '1 day'`);
  await db.delete(T.loginAttempts).where(sql`${T.loginAttempts.at} < now() - interval '30 days'`);
  await db.delete(T.passwordTokens).where(and(gt(sql`now()`, T.passwordTokens.expiresAt)));
}
