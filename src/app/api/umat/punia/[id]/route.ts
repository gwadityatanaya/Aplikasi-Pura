import { and, eq } from "drizzle-orm";
import { db, schema as T } from "@/server/db";
import { requireCurrent } from "@/server/auth";
import { ApiError, json, route } from "@/server/http";
import type { PuniaProof } from "@/lib/punia-proof";

export const dynamic = "force-dynamic";

/** Only the last 4 digits of an account number ever leave the server here. */
const maskAccount = (n: string | null) => {
  const digits = (n ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : null;
};

/**
 * Digital proof of ONE punia, for the account that sent it — nobody else (not pengurus, not Admin
 * Utama: they have their own screens). Deliberately leaves out who verified or typed it in, the
 * full account number, the transfer photo and the internal ids of people.
 */
export const GET = route(async (_req: Request, { params }: { params: { id: string } }) => {
  const cur = await requireCurrent();
  const [d] = await db.select().from(T.donations).where(and(eq(T.donations.id, params.id), eq(T.donations.submittedBy, cur.user.id)));
  if (!d) throw new ApiError(404, "Bukti punia tidak ditemukan.");
  const [t] = await db.select({ name: T.temples.name, slug: T.temples.slug }).from(T.temples).where(eq(T.temples.id, d.templeId));
  const [txr] = d.transactionId ? await db.select({ number: T.transactions.number, accountId: T.transactions.accountId }).from(T.transactions).where(eq(T.transactions.id, d.transactionId)) : [];
  const accId = txr?.accountId ?? d.accountId;
  const [acc] = accId ? await db.select({ type: T.accounts.type, label: T.accounts.label, name: T.accounts.name, bankName: T.accounts.bankName, accountNumber: T.accounts.accountNumber }).from(T.accounts).where(eq(T.accounts.id, accId)) : [];
  const campaign = d.campaignId ? (await db.select({ title: T.campaigns.title }).from(T.campaigns).where(eq(T.campaigns.id, d.campaignId)))[0]?.title : undefined;
  const activity = d.activityId ? (await db.select({ name: T.activities.name }).from(T.activities).where(eq(T.activities.id, d.activityId)))[0]?.name : undefined;
  const status: PuniaProof["status"] = d.correctedAt ? "corrected" : (d.status as PuniaProof["status"]);
  const proof: PuniaProof = {
    id: d.id,
    code: d.id.replace(/^[a-z]+_/, "").toUpperCase(),
    templeName: t?.name ?? "Pura",
    templeSlug: t?.slug,
    amount: d.amount,
    transferDate: d.transferDate ?? d.date,
    sentAt: d.createdAt.toISOString(),
    status,
    number: d.status === "verified" ? txr?.number : undefined,
    verifiedAt: d.status === "verified" && d.verifiedAt ? d.verifiedAt.toISOString() : undefined,
    rejectedReason: d.status === "rejected" ? d.rejectedReason ?? undefined : undefined,
    purpose: d.purpose,
    channel: d.channel,
    campaign,
    activity,
    into: acc ? (acc.type === "cash" ? "Tunai (kas pura)" : [acc.label || acc.name, acc.bankName, maskAccount(acc.accountNumber)].filter(Boolean).join(" · ")) : undefined,
    referenceNo: d.referenceNo ?? undefined,
    anonymous: d.privacy !== "public",
    // The owner sees their own name, even on an anonymous punia; nobody else gets this route.
    donorName: d.donorName,
  };
  return json({ ok: true, proof });
});
