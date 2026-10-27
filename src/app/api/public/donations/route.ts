import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { rateLimit } from "@/server/auth";
import { ApiError, assertSameOrigin, clientIp, json, readJson, route, todayInAppTz } from "@/server/http";
import { persistImage } from "@/server/images";
import { logActivity } from "@/server/log";
import { rupiah, uid } from "@/lib/format";

export const dynamic = "force-dynamic";

const schemaIn = z.object({
  campaignId: z.string().min(1).max(64),
  donorName: z.string().trim().min(2).max(80),
  amount: z.number().int().min(10_000).max(10_000_000_000),
  privacy: z.enum(["public", "anonymous", "private"]),
  message: z.string().trim().max(200).optional(),
  evidence: z.string().max(3_500_000).optional(),
});

/** A member of the public confirms they transferred a donation. It stays "pending" until a treasurer verifies it. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await rateLimit(`donation:${clientIp(req) ?? "unknown"}`, 5, 30);
  const i = schemaIn.parse(await readJson(req));
  const [c] = await db.select().from(schema.campaigns).where(and(eq(schema.campaigns.id, i.campaignId), eq(schema.campaigns.status, "active")));
  const [t] = c ? await db.select({ status: schema.temples.status }).from(schema.temples).where(eq(schema.temples.id, c.templeId)) : [];
  if (!c || t?.status !== "active") throw new ApiError(404, "Penggalangan dana tidak ditemukan atau sudah ditutup.");
  await db.transaction(async (tx) => {
    const evidence = await persistImage(i.evidence, { templeId: c.templeId, isPublic: false, userId: null }, tx);
    const id = uid("dn");
    await tx.insert(schema.donations).values({
      id, templeId: c.templeId, campaignId: c.id, donorName: i.donorName, amount: i.amount, date: todayInAppTz(), privacy: i.privacy,
      status: "pending", message: i.message || null, evidence, channel: "transfer",
    });
    await tx.insert(schema.notifications).values({
      id: uid("n"), templeId: c.templeId, kind: "donation_pending", title: "Donasi baru menunggu verifikasi",
      body: `${i.donorName} — ${rupiah(i.amount)} untuk ${c.title}.`, href: `/app/campaign/${c.id}?tab=verifikasi`,
    });
    await logActivity({ actor: { id: null, name: `Publik: ${i.donorName}` }, action: "Konfirmasi donasi dari publik", entity: "donation", entityId: id, detail: `${rupiah(i.amount)} untuk ${c.title}`, templeId: c.templeId, req }, tx);
  });
  return json({ ok: true });
});
