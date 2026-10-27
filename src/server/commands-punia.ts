import "server-only";
import { z } from "zod";
import { and, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { db, schema as T, type Tx } from "./db";
import { ApiError, todayInAppTz } from "./http";
import { requirePerm, requireTemple, type Ctx } from "./context";
import { imageHash, persistImage } from "./images";
import { id, image, isoDate, log, maxDate, nextNumber, notify, one, optId, optText, text, type Handler } from "./commands";
import * as m from "./map";
import { PURPOSE_CATEGORY } from "@/lib/categories";
import { PURPOSE_LABEL } from "@/lib/permissions";
import { rupiah, uid } from "@/lib/format";

const purpose = z.enum(["umum", "odalan", "pembangunan", "lainnya"]);
const amount = z.number().int().min(1_000, "Minimal Rp1.000").max(10_000_000_000);
const refNo = z.string().trim().max(60).optional().nullable().transform((v) => v?.replace(/\s+/g, "").toUpperCase() || null);

function minDate() {
  const d = new Date(todayInAppTz() + "T00:00:00Z");
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}
function checkDate(date: string) {
  if (date > maxDate()) throw new ApiError(400, "Tanggal transfer tidak boleh di masa depan.");
  if (date < minDate()) throw new ApiError(400, "Tanggal transfer terlalu lama (lebih dari 1 tahun).");
}

/**
 * Duplicate-proof checks: the same file, or the same amount + date + reference number,
 * already used by another punia that is not rejected.
 */
async function assertNotDuplicate(tx: Tx, o: { hash: string | null; templeId: string; amount: number; transferDate: string; referenceNo: string | null; exceptId?: string }) {
  const notSelf = o.exceptId ? ne(T.donations.id, o.exceptId) : undefined;
  if (o.hash) {
    const [dup] = await tx.select({ id: T.donations.id }).from(T.donations).where(and(eq(T.donations.evidenceHash, o.hash), ne(T.donations.status, "rejected"), notSelf)).limit(1);
    if (dup) throw new ApiError(409, "Bukti transfer ini sudah pernah diunggah. Jika Anda berpunia lagi, unggah bukti transfer yang baru.");
  }
  if (o.referenceNo) {
    const [dup] = await tx
      .select({ id: T.donations.id })
      .from(T.donations)
      .where(and(eq(T.donations.templeId, o.templeId), eq(T.donations.amount, o.amount), eq(T.donations.transferDate, o.transferDate), eq(T.donations.referenceNo, o.referenceNo), ne(T.donations.status, "rejected"), notSelf))
      .limit(1);
    if (dup) throw new ApiError(409, "Punia dengan nominal, tanggal, dan nomor referensi yang sama sudah tercatat.");
  }
}

/** Activity / campaign must belong to the same temple. */
async function checkGrouping(tx: Tx, templeId: string, activityId: string | null, campaignId: string | null) {
  if (activityId) await one(tx.select().from(T.activities).where(and(eq(T.activities.id, activityId), eq(T.activities.templeId, templeId))), "Kegiatan tidak ditemukan.");
  if (campaignId) await one(tx.select().from(T.campaigns).where(and(eq(T.campaigns.id, campaignId), eq(T.campaigns.templeId, templeId))), "Kegiatan/campaign tidak ditemukan.");
}

const isSelf = (ctx: Ctx, d: { submittedBy: string | null; submitterEmail: string | null }) =>
  d.submittedBy === ctx.user.id || (!!d.submitterEmail && d.submitterEmail.toLowerCase() === ctx.user.email.toLowerCase());

/** Verifies one pending punia inside a transaction and books exactly one income entry. */
async function verifyOne(ctx: Ctx, tx: Tx, donationId: string, templeId: string): Promise<{ ok: true; number: string } | { ok: false; reason: string }> {
  const [d] = await tx.select().from(T.donations).where(and(eq(T.donations.id, donationId), eq(T.donations.templeId, templeId))).for("update");
  if (!d) return { ok: false, reason: "Punia tidak ditemukan di pura ini." };
  if (d.status === "verified") return { ok: false, reason: "Sudah terverifikasi." };
  if (d.status === "rejected") return { ok: false, reason: "Punia ini sudah ditolak." };
  if (isSelf(ctx, d)) return { ok: false, reason: "Dikirim oleh Anda sendiri — harus disetujui pengurus lain." };

  const campaign = d.campaignId ? (await tx.select().from(T.campaigns).where(eq(T.campaigns.id, d.campaignId)))[0] : undefined;
  const accounts = await tx.select().from(T.accounts).where(and(eq(T.accounts.templeId, templeId), eq(T.accounts.archived, false)));
  const cash = accounts.find((a) => a.type === "cash");
  const bank = accounts.find((a) => a.type === "bank");
  const accountId = d.channel === "tunai" ? (cash ?? bank ?? accounts[0])?.id : (campaign?.accountId ?? bank?.id ?? accounts[0]?.id);
  if (!accountId) return { ok: false, reason: "Pura belum memiliki kas/rekening pencatatan." };
  const categoryName = campaign ? "Donasi Penggalangan Dana" : PURPOSE_CATEGORY[(d.purpose as keyof typeof PURPOSE_CATEGORY) ?? "umum"];
  const cats = await tx.select().from(T.categories).where(and(eq(T.categories.templeId, templeId), eq(T.categories.type, "income")));
  const cat = cats.find((c) => c.name === categoryName) ?? cats.find((c) => c.name.startsWith("Dana Punia")) ?? cats[0];
  const date = d.transferDate ?? d.date;
  const shown = d.privacy === "public" ? d.donorName : "Anonim";

  const [row] = await tx
    .insert(T.transactions)
    .values({
      id: uid("tx"), number: await nextNumber(tx, templeId, date), templeId, type: "income", amount: d.amount, date, categoryId: cat?.id ?? null,
      description: `Punia: ${shown}`, accountId, activityId: d.activityId ?? campaign?.activityId ?? null, campaignId: d.campaignId, donationId: d.id,
      source: shown, receipt: d.evidence, status: "confirmed", createdBy: ctx.user.id, idempotencyKey: `donation:${d.id}`,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) return { ok: false, reason: "Sudah tercatat." };
  // The database trigger also refuses self-verification, as a second line of defence.
  await tx.update(T.donations).set({ status: "verified", transactionId: row.id, verifiedAt: new Date(), verifiedBy: ctx.user.id, rejectedReason: null }).where(eq(T.donations.id, d.id));
  await tx.update(T.notifications).set({ read: true }).where(and(eq(T.notifications.templeId, templeId), eq(T.notifications.kind, "donation_pending"), sql`${T.notifications.href} like ${"%" + d.id + "%"}`));
  await log(ctx, tx, { action: "Memverifikasi punia", entity: "donation", entityId: d.id, detail: `${d.donorName}${d.privacy !== "public" ? " (anonim)" : ""} — ${rupiah(d.amount)}. Tercatat sebagai ${row.number}.`, templeId });
  return { ok: true, number: row.number };
}

export const puniaCommands: Record<string, Handler> = {
  /** Umat sends a punia with proof of transfer. Stays "menunggu" until a pengurus verifies it. */
  async submitPunia(ctx, p) {
    const i = z
      .object({
        templeId: id, amount, transferDate: isoDate, evidence: z.string().min(30, "Unggah foto bukti transfer").max(3_500_000), anonymous: z.boolean(),
        purpose, activityId: optId, campaignId: optId, referenceNo: refNo, message: optText(300),
      })
      .parse(p);
    checkDate(i.transferDate);
    const recent = await db.select({ n: sql<number>`count(*)::int` }).from(T.donations).where(and(eq(T.donations.submittedBy, ctx.user.id), gt(T.donations.createdAt, new Date(Date.now() - 3600_000))));
    if (recent[0].n >= 10) throw new ApiError(429, "Terlalu banyak punia dalam satu jam. Coba lagi nanti.");
    const hash = imageHash(i.evidence);
    if (!hash) throw new ApiError(400, "Format bukti tidak didukung. Gunakan foto JPG, PNG atau WEBP.");
    return db.transaction(async (tx) => {
      const t = await one(tx.select().from(T.temples).where(eq(T.temples.id, i.templeId)), "Pura tidak ditemukan.");
      if (t.status !== "active") throw new ApiError(409, "Pura ini belum aktif menerima punia.");
      if (!t.bankAccountNumber) throw new ApiError(409, "Pura ini belum memiliki info rekening. Punia belum bisa dikirim lewat aplikasi.");
      await checkGrouping(tx, t.id, i.activityId, i.campaignId);
      await assertNotDuplicate(tx, { hash, templeId: t.id, amount: i.amount, transferDate: i.transferDate, referenceNo: i.referenceNo });
      const evidence = await persistImage(i.evidence, { templeId: t.id, isPublic: false, userId: ctx.user.id }, tx);
      const donationId = uid("dn");
      const [row] = await tx
        .insert(T.donations)
        .values({
          id: donationId, templeId: t.id, campaignId: i.campaignId, activityId: i.activityId, purpose: i.purpose, donorName: ctx.user.name, amount: i.amount,
          date: todayInAppTz(), transferDate: i.transferDate, referenceNo: i.referenceNo, privacy: i.anonymous ? "anonymous" : "public", status: "pending",
          message: i.message, evidence, evidenceHash: hash, channel: "transfer", submittedBy: ctx.user.id, submitterEmail: ctx.user.email.toLowerCase(),
        })
        .returning();
      await notify(tx, { templeId: t.id, kind: "donation_pending", title: "Punia baru menunggu verifikasi", body: `${rupiah(i.amount)} (${PURPOSE_LABEL[i.purpose]})${i.anonymous ? " — anonim" : ` dari ${ctx.user.name}`}.`, href: `/app/punia?id=${donationId}` });
      await log(ctx, tx, { action: "Mengirim punia", entity: "donation", entityId: donationId, detail: `${rupiah(i.amount)} ke ${t.name}${i.anonymous ? " (anonim)" : ""}`, templeId: t.id });
      return m.toDonation(row);
    });
  },

  /** Umat fixes and re-sends a punia that was rejected. */
  async resubmitPunia(ctx, p) {
    const i = z.object({ id, amount, transferDate: isoDate, evidence: image, referenceNo: refNo }).parse(p);
    checkDate(i.transferDate);
    return db.transaction(async (tx) => {
      const d = await one(tx.select().from(T.donations).where(and(eq(T.donations.id, i.id), eq(T.donations.submittedBy, ctx.user.id))).for("update"), "Punia tidak ditemukan.");
      if (d.status !== "rejected") throw new ApiError(409, "Hanya punia yang ditolak yang dapat dikirim ulang.");
      const newHash = i.evidence?.startsWith("data:") ? imageHash(i.evidence) : d.evidenceHash;
      await assertNotDuplicate(tx, { hash: newHash, templeId: d.templeId, amount: i.amount, transferDate: i.transferDate, referenceNo: i.referenceNo, exceptId: d.id });
      const evidence = i.evidence?.startsWith("data:") ? await persistImage(i.evidence, { templeId: d.templeId, isPublic: false, userId: ctx.user.id }, tx) : d.evidence;
      await tx
        .update(T.donations)
        .set({ status: "pending", amount: i.amount, transferDate: i.transferDate, referenceNo: i.referenceNo, evidence, evidenceHash: newHash, rejectedReason: null })
        .where(eq(T.donations.id, d.id));
      await notify(tx, { templeId: d.templeId, kind: "donation_pending", title: "Punia dikirim ulang", body: `${rupiah(i.amount)} dari ${d.privacy === "public" ? d.donorName : "umat (anonim)"} menunggu verifikasi.`, href: `/app/punia?id=${d.id}` });
      await log(ctx, tx, { action: "Mengirim ulang punia", entity: "donation", entityId: d.id, detail: `${rupiah(i.amount)} (sebelumnya ditolak: ${d.rejectedReason ?? "-"})`, templeId: d.templeId });
      return null;
    });
  },

  /**
   * A pengurus records a punia received by cash, WhatsApp or transfer. It counts as verified by the
   * person who typed it in — unless the donor email is their own, then another pengurus must approve.
   */
  async addManualPunia(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "donation.manage", "mencatat punia manual");
    const i = z
      .object({
        donorName: text(80).min(2, "Isi nama donatur"), donorEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")).transform((v) => v || null),
        amount, transferDate: isoDate, anonymous: z.boolean(), purpose, channel: z.enum(["tunai", "whatsapp", "transfer"]),
        activityId: optId, campaignId: optId, referenceNo: refNo, evidence: image, message: optText(300),
      })
      .parse(p);
    checkDate(i.transferDate);
    return db.transaction(async (tx) => {
      await checkGrouping(tx, templeId, i.activityId, i.campaignId);
      const hash = imageHash(i.evidence);
      await assertNotDuplicate(tx, { hash, templeId, amount: i.amount, transferDate: i.transferDate, referenceNo: i.referenceNo });
      const evidence = await persistImage(i.evidence, { templeId, isPublic: false, userId: ctx.user.id }, tx);
      const donor = i.donorEmail ? (await tx.select().from(T.users).where(sql`lower(${T.users.email}) = ${i.donorEmail}`))[0] : undefined;
      const donationId = uid("dn");
      await tx.insert(T.donations).values({
        id: donationId, templeId, campaignId: i.campaignId, activityId: i.activityId, purpose: i.purpose, donorName: i.donorName, amount: i.amount,
        date: todayInAppTz(), transferDate: i.transferDate, referenceNo: i.referenceNo, privacy: i.anonymous ? "anonymous" : "public", status: "pending",
        message: i.message, evidence, evidenceHash: hash, channel: i.channel, inputBy: ctx.user.id, submittedBy: donor?.id ?? null, submitterEmail: i.donorEmail,
      });
      await log(ctx, tx, { action: "Mencatat punia manual", entity: "donation", entityId: donationId, detail: `${i.donorName}${i.anonymous ? " (anonim)" : ""} — ${rupiah(i.amount)} via ${i.channel}`, templeId });
      const self = !!i.donorEmail && i.donorEmail === ctx.user.email.toLowerCase();
      if (self) {
        await notify(tx, { templeId, kind: "donation_pending", title: "Punia pengurus menunggu verifikasi", body: `${ctx.user.name} mencatat punianya sendiri ${rupiah(i.amount)} — perlu disetujui pengurus lain.`, href: `/app/punia?id=${donationId}` });
        return { id: donationId, verified: false };
      }
      const r = await verifyOne(ctx, tx, donationId, templeId);
      if (!r.ok) throw new ApiError(409, r.reason);
      return { id: donationId, verified: true, number: r.number };
    });
  },

  /** Approve one or many punia (bulk). Each is handled separately so one problem does not block the rest. */
  async verifyPunia(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "donation.manage", "memverifikasi punia");
    const { ids } = z.object({ ids: z.array(id).min(1).max(100) }).parse(p);
    let verified = 0;
    const skipped: { id: string; reason: string }[] = [];
    for (const did of Array.from(new Set(ids))) {
      try {
        const r = await db.transaction((tx) => verifyOne(ctx, tx, did, templeId));
        if (r.ok) verified++;
        else skipped.push({ id: did, reason: r.reason });
      } catch (e) {
        skipped.push({ id: did, reason: e instanceof Error && /sendiri/.test(e.message) ? "Dikirim oleh Anda sendiri — harus disetujui pengurus lain." : "Gagal diproses." });
      }
    }
    if (!verified && skipped.length === 1) throw new ApiError(409, skipped[0].reason);
    return { verified, skipped };
  },

  async rejectPunia(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "donation.manage", "menolak punia");
    const { id: did, reason } = z.object({ id, reason: text(300).min(5, "Tuliskan alasan penolakan (min. 5 huruf)") }).parse(p);
    return db.transaction(async (tx) => {
      const d = await one(tx.select().from(T.donations).where(and(eq(T.donations.id, did), eq(T.donations.templeId, templeId))).for("update"), "Punia tidak ditemukan.");
      if (d.status !== "pending") throw new ApiError(409, "Hanya punia yang menunggu yang dapat ditolak.");
      if (isSelf(ctx, d)) throw new ApiError(409, "Punia yang Anda kirim sendiri harus ditinjau pengurus lain.");
      await tx.update(T.donations).set({ status: "rejected", rejectedReason: reason }).where(eq(T.donations.id, did));
      await log(ctx, tx, { action: "Menolak punia", entity: "donation", entityId: did, detail: `${d.donorName} — ${rupiah(d.amount)}: ${reason}`, templeId });
      return null;
    });
  },
};

/** Counts pending punia per temple (for badges and email digests). */
export async function pendingCounts(templeIds: string[]) {
  if (!templeIds.length) return new Map<string, number>();
  const rows = await db
    .select({ templeId: T.donations.templeId, n: sql<number>`count(*)::int` })
    .from(T.donations)
    .where(and(inArray(T.donations.templeId, templeIds), eq(T.donations.status, "pending")))
    .groupBy(T.donations.templeId);
  return new Map(rows.map((r) => [r.templeId, r.n]));
}


