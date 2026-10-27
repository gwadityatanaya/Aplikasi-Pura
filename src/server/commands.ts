import "server-only";
import { z } from "zod";
import { and, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { db, schema, type Tx } from "./db";
import { ApiError, todayInAppTz } from "./http";
import { requirePerm, requireSuperAdmin, requireTemple, templeAccess, type Ctx } from "./context";
import { diff, logActivity } from "./log";
import { persistImage } from "./images";
import * as m from "./map";
import { byCategory, summarize } from "@/lib/ledger";
import { rupiah, slugify, uid } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { AppNotification, DataState } from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation building blocks
// ---------------------------------------------------------------------------
export const id = z.string().min(1).max(64);
export const optId = z.string().max(64).optional().nullable().transform((v) => v || null);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid");
export const money = z.number().int().min(0).max(1_000_000_000_000);
export const text = (max: number) => z.string().trim().max(max);
export const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);
export const image = z.string().max(3_500_000).optional().nullable();
export const coverVariant = z.enum(["emerald", "dusk", "gold", "ocean", "forest"]);
export const transparencySchema = z.object({
  showPublicProfile: z.boolean(), showCampaigns: z.boolean(), showPublishedSummaries: z.boolean(), showDonorList: z.boolean(), showBankAccount: z.boolean(),
  showBalance: z.boolean(), showRecentTransactions: z.boolean(), recentCount: z.number().int().min(3).max(5),
}).partial();

export const txInput = z.object({
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

export function maxDate() {
  // Allow "today" in any Indonesian time zone (WIB–WIT).
  const d = new Date(todayInAppTz() + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function nextNumber(tx: Tx, templeId: string, date: string) {
  const [r] = await tx.update(T.temples).set({ txCounter: sql`${T.temples.txCounter} + 1` }).where(eq(T.temples.id, templeId)).returning({ n: T.temples.txCounter });
  return `TRX-${date.slice(0, 4)}-${String(r.n).padStart(4, "0")}`;
}

export async function notify(tx: Tx, n: Omit<AppNotification, "id" | "date" | "read">) {
  await tx.insert(T.notifications).values({ id: uid("n"), templeId: n.templeId, kind: n.kind, title: n.title, body: n.body, href: n.href ?? null });
}

export function log(ctx: Ctx, tx: Tx, e: { action: string; entity: string; detail: string; entityId?: string | null; changes?: unknown; templeId?: string | null }) {
  return logActivity({ ...e, actor: ctx.actor, templeId: e.templeId === undefined ? ctx.templeId : e.templeId, req: ctx.req }, tx);
}

export async function one<R>(rows: Promise<R[]>, msg = "Data tidak ditemukan.") {
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

export async function ledgerFor(tx: Tx, templeId: string): Pick<DataState, "transactions" | "accounts" | "categories"> extends infer R ? Promise<R> : never {
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
export type Handler = (ctx: Ctx, payload: unknown) => Promise<unknown>;

export const coreCommands: Record<string, Handler> = {
  async setActiveTemple(ctx, p) {
    const { templeId } = z.object({ templeId: id }).parse(p);
    const role = (await templeAccess(ctx.user)).get(templeId);
    if (!role) throw new ApiError(403, "Anda tidak memiliki akses ke pura ini.");
    await db.update(T.sessions).set({ activeTempleId: templeId }).where(eq(T.sessions.id, ctx.session.id));
    ctx.templeId = templeId;
    ctx.role = role;
    return null;
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
    // Name, location, banjar pengempon and bank details are managed in the Back Office (Admin Utama).
    const i = z
      .object({
        description: text(600), phone: text(20), email: optText(120), cover: coverVariant, photo: image, established: optText(20),
        transparency: transparencySchema,
        branding: z.object({ headerTitle: text(160), signatoryName: text(120), signatoryRole: text(80), footerNote: text(200) }),
      })
      .partial()
      .parse(p);
    return db.transaction(async (tx) => {
      const cur = await one(tx.select().from(T.temples).where(eq(T.temples.id, templeId)));
      const values: Record<string, unknown> = { ...i };
      if (i.transparency) values.transparency = { ...cur.transparency, ...i.transparency };
      if (i.photo !== undefined) values.photo = await persistImage(i.photo, { templeId, isPublic: true, userId: ctx.user.id }, tx);
      await tx.update(T.temples).set(values).where(eq(T.temples.id, templeId));
      await log(ctx, tx, { action: "Mengubah pengaturan pura", entity: "settings", entityId: templeId, detail: cur.name, changes: diff(cur, values, Object.keys(values)) });
      return null;
    });
  },

  async updateUser(ctx, p) {
    const i = z.object({ name: text(120).min(3), callName: text(60).min(2), phone: optText(20), emailDigest: z.boolean() }).partial().parse(p);
    await db.transaction(async (tx) => {
      await tx.update(T.users).set(i).where(eq(T.users.id, ctx.user.id));
      await log(ctx, tx, { action: "Mengubah profil sendiri", entity: "user", entityId: ctx.user.id, detail: ctx.user.name, changes: diff(ctx.user, i, Object.keys(i)), templeId: null });
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
      const { id: aid, ...input } = i;
      // Bank details on bookkeeping accounts are informational; only Admin Utama may change them.
      const values: Partial<typeof input> & Pick<typeof input, "name" | "type" | "openingBalance" | "openingDate"> = ctx.user.isSuperAdmin
        ? input
        : { name: input.name, type: input.type, openingBalance: input.openingBalance, openingDate: input.openingDate, archived: input.archived };
      if (aid) {
        const cur = await one(tx.select().from(T.accounts).where(and(eq(T.accounts.id, aid), eq(T.accounts.templeId, templeId))));
        const used = await tx.select({ id: T.transactions.id }).from(T.transactions).where(and(eq(T.transactions.templeId, templeId), or(eq(T.transactions.accountId, aid), eq(T.transactions.toAccountId, aid)))).limit(1);
        if (used[0] && (values.openingBalance !== cur.openingBalance || values.openingDate !== cur.openingDate || values.type !== cur.type))
          throw new ApiError(409, "Saldo awal dan jenis rekening terkunci karena sudah ada transaksi.");
        await tx.update(T.accounts).set(values).where(eq(T.accounts.id, aid));
        await log(ctx, tx, { action: "Mengubah kas/rekening", entity: "settings", entityId: aid, detail: values.name, changes: diff(cur, values, Object.keys(values)) });
      } else {
        const newId = uid("acc");
        await tx.insert(T.accounts).values({ ...values, id: newId, templeId, isPublic: false, archived: false });
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

  // ---- Admin Utama only --------------------------------------------------
  async setTempleStatus(ctx, p) {
    await requireSuperAdmin(ctx, "mengubah status pura");
    const { templeId, status } = z.object({ templeId: id, status: z.enum(["active", "pending", "rejected"]) }).parse(p);
    return db.transaction(async (tx) => {
      const t = await one(tx.select().from(T.temples).where(eq(T.temples.id, templeId)));
      await tx.update(T.temples).set({ status }).where(eq(T.temples.id, templeId));
      await log(ctx, tx, { action: status === "active" ? "Menyetujui pura" : status === "rejected" ? "Menolak pura" : "Menangguhkan pura", entity: "settings", entityId: templeId, detail: t.name, templeId });
      return null;
    });
  },

};

async function canWriteTx(ctx: Ctx) {
  return can(ctx.role, "tx.create");
}

/** Removes expired sessions and old rate-limit rows. Cheap; called occasionally. */
export async function housekeeping() {
  await db.delete(T.sessions).where(sql`${T.sessions.expiresAt} < now()`);
  await db.delete(T.rateLimits).where(sql`${T.rateLimits.at} < now() - interval '1 day'`);
  await db.delete(T.loginAttempts).where(sql`${T.loginAttempts.at} < now() - interval '30 days'`);
  await db.delete(T.passwordTokens).where(and(gt(sql`now()`, T.passwordTokens.expiresAt)));
}
