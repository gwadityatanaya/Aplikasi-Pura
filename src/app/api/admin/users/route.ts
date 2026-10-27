import { desc } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getCtx, requirePerm } from "@/server/context";
import { json, route } from "@/server/http";
import * as m from "@/server/map";

export const dynamic = "force-dynamic";

/** All users, their temple roles and every temple — for the Admin Utama user management screen. */
export const GET = route(async (req: Request) => {
  const ctx = await getCtx(req);
  await requirePerm(ctx, "admin.manage", "melihat daftar semua pengguna");
  const [users, memberships, temples] = await Promise.all([
    db.select().from(schema.users).orderBy(desc(schema.users.isSuperAdmin), schema.users.name),
    db.select().from(schema.memberships),
    db.select().from(schema.temples).orderBy(schema.temples.name),
  ]);
  return json({
    ok: true,
    users: users.map((u) => ({ ...m.toUser(u), activated: !!u.passwordHash })),
    memberships: memberships.map(m.toMembership),
    temples: temples.map(m.toTemple),
  });
});
