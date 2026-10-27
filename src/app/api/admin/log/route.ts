import { and, desc, eq, gte, ilike, lt, lte, or, type SQL } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getCtx, requireSuperAdmin } from "@/server/context";
import { json, route } from "@/server/http";
import * as m from "@/server/map";

export const dynamic = "force-dynamic";

/** Read-only view of the immutable activity log. Admin Utama only. */
export const GET = route(async (req: Request) => {
  const ctx = await getCtx(req);
  // Admin Utama account check (not the open temple's role): works before any temple exists.
  await requireSuperAdmin(ctx, "melihat Log Aktivitas");
  const p = new URL(req.url).searchParams;
  const L = schema.activityLog;
  const where: SQL[] = [];
  const kind = p.get("kind");
  if (kind === "login") where.push(eq(L.entity, "session"));
  else if (kind && kind !== "all") where.push(eq(L.entity, kind));
  const q = p.get("q")?.trim();
  if (q) where.push(or(ilike(L.detail, `%${q}%`), ilike(L.actorName, `%${q}%`), ilike(L.action, `%${q}%`), ilike(L.actorEmail, `%${q}%`))!);
  const from = p.get("from");
  const to = p.get("to");
  if (from) where.push(gte(L.at, new Date(`${from}T00:00:00+08:00`)));
  if (to) where.push(lte(L.at, new Date(`${to}T23:59:59+08:00`)));
  const before = Number(p.get("before"));
  if (before) where.push(lt(L.id, before));
  const temple = p.get("temple");
  if (temple) where.push(eq(L.templeId, temple));
  const limit = Math.min(200, Number(p.get("limit")) || 50);
  const rows = await db.select().from(L).where(where.length ? and(...where) : undefined).orderBy(desc(L.id)).limit(limit + 1);
  return json({ ok: true, entries: rows.slice(0, limit).map(m.toAudit), nextBefore: rows.length > limit ? rows[limit - 1].id : null });
});
