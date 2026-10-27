import { desc } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getCtx, requireSuperAdmin } from "@/server/context";
import { json, route } from "@/server/http";
import { pendingCounts } from "@/server/commands-punia";
import * as m from "@/server/map";

export const dynamic = "force-dynamic";

/** Back Office data: every banjar, temple (with bank info and banjar pengempon), staff role and account. */
export const GET = route(async (req: Request) => {
  const ctx = await getCtx(req);
  await requireSuperAdmin(ctx, "membuka Back Office");
  const [users, memberships, temples, banjars, templeBanjars, banjarMembers] = await Promise.all([
    db.select().from(schema.users).orderBy(desc(schema.users.isSuperAdmin), schema.users.name),
    db.select().from(schema.memberships),
    db.select().from(schema.temples).orderBy(schema.temples.name),
    db.select().from(schema.banjars).orderBy(schema.banjars.name),
    db.select().from(schema.templeBanjars),
    db.select().from(schema.banjarMembers),
  ]);
  const pending = await pendingCounts(temples.map((t) => t.id));
  return json({
    ok: true,
    users: users.filter((u) => u.status !== "deleted").map(m.toUser),
    memberships: memberships.map(m.toMembership),
    temples: temples.map((t) => ({
      ...m.toTemple(t),
      banjarIds: templeBanjars.filter((r) => r.templeId === t.id).map((r) => r.banjarId),
      pengurusCount: memberships.filter((x) => x.templeId === t.id && x.role === "pengurus" && x.status === "active").length,
      pendingCount: pending.get(t.id) ?? 0,
    })),
    banjars: banjars.map(m.toBanjar),
    banjarMembers: banjarMembers.map(m.toBanjarMember),
  });
});
