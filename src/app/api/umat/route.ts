import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { requireCurrent } from "@/server/auth";
import { json, route } from "@/server/http";
import * as m from "@/server/map";

export const dynamic = "force-dynamic";

/** The signed-in person's own punia history (any account, including staff in "Tampilan Umat"). */
export const GET = route(async () => {
  const cur = await requireCurrent();
  const rows = await db.select().from(schema.donations).where(eq(schema.donations.submittedBy, cur.user.id)).orderBy(desc(schema.donations.createdAt)).limit(200);
  const templeIds = Array.from(new Set(rows.map((r) => r.templeId)));
  const temples = templeIds.length ? await db.select({ id: schema.temples.id, name: schema.temples.name, slug: schema.temples.slug }).from(schema.temples).where(inArray(schema.temples.id, templeIds)) : [];
  return json({
    ok: true,
    me: { id: cur.user.id, name: cur.user.name, email: cur.user.email, emailDigest: cur.user.emailDigest },
    punia: rows.map((r) => {
      const d = m.toDonation(r);
      // Never echo internal fields back, even to the owner.
      return { ...d, inputBy: undefined, verifiedBy: undefined, correctedBy: undefined, temple: temples.find((t) => t.id === r.templeId) };
    }),
  });
});
