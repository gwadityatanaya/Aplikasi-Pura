import { desc } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getCtx, requireSuperAdmin } from "@/server/context";
import { json, route } from "@/server/http";
import type { RegistrationRequest } from "@/lib/registration";

export const dynamic = "force-dynamic";

/** Registration requests — Admin Utama only (applicants' contact details). */
export const GET = route(async (req: Request) => {
  const ctx = await getCtx(req);
  await requireSuperAdmin(ctx, "melihat pengajuan pendaftaran");
  const rows = await db.select().from(schema.registrationRequests).orderBy(desc(schema.registrationRequests.createdAt)).limit(500);
  const requests: RegistrationRequest[] = rows.map((r) => ({
    ...r,
    status: r.status as RegistrationRequest["status"],
    provinceCode: r.provinceCode ?? undefined, regencyCode: r.regencyCode ?? undefined, districtCode: r.districtCode ?? undefined, villageCode: r.villageCode ?? undefined,
    convertedBanjarId: r.convertedBanjarId ?? undefined, convertedTempleId: r.convertedTempleId ?? undefined,
    consentAt: r.consentAt.toISOString(), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  }));
  return json({ ok: true, requests });
});
