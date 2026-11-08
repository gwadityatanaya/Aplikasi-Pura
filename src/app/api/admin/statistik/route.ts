import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getCtx, requireSuperAdmin } from "@/server/context";
import { json, route } from "@/server/http";

export const dynamic = "force-dynamic";

export interface AppStats {
  banjarActive: number;
  templeActive: number;
  templeOther: number;
  users: number;
  staff: number;
  /** Last 12 months, oldest first: verified punia (corrections excluded) */
  months: { month: string; count: number; total: number }[];
  /** Per banjar — numbers only */
  perBanjar: { banjar: string; temples: number; count: number; total: number }[];
}

/**
 * Dasbor angka for Admin Utama: counts and sums only. Never a donor name, message or proof; no
 * per-donation rows leave this route.
 */
export const GET = route(async (req: Request) => {
  const ctx = await getCtx(req);
  await requireSuperAdmin(ctx, "melihat dasbor angka");
  const since = sql`date_trunc('month', current_date) - interval '11 months'`;
  const [[b], [t], [u], [st], months, perBanjar] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(schema.banjars).where(eq(schema.banjars.status, "active")),
    db.select({ active: sql<number>`count(*) filter (where status = 'active')::int`, other: sql<number>`count(*) filter (where status <> 'active')::int` }).from(schema.temples),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.users).where(ne(schema.users.status, "deleted")),
    db.select({ n: sql<number>`count(distinct user_id)::int` }).from(sql`(select user_id from memberships where status = 'active' union select user_id from banjar_members where status = 'active') s`),
    db
      .select({ month: sql<string>`to_char(date_trunc('month', coalesce(${schema.donations.transferDate}, ${schema.donations.date})), 'YYYY-MM')`, count: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${schema.donations.amount}), 0)::bigint` })
      .from(schema.donations)
      .where(and(eq(schema.donations.status, "verified"), isNull(schema.donations.correctedAt), sql`coalesce(${schema.donations.transferDate}, ${schema.donations.date}) >= ${since}`))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db.execute(sql`
      select b.name as banjar, count(distinct tb.temple_id)::int as temples,
             count(d.id)::int as count, coalesce(sum(d.amount), 0)::bigint as total
      from banjars b
      left join temple_banjars tb on tb.banjar_id = b.id
      left join donations d on d.temple_id = tb.temple_id and d.status = 'verified' and d.corrected_at is null
        and coalesce(d.transfer_date, d.date) >= ${since}
      where b.status = 'active'
      group by b.id, b.name order by b.name`),
  ]);
  // Every month of the last year, also those without punia.
  const all: AppStats["months"] = [];
  const now = new Date();
  for (let k = 11; k >= 0; k--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1)).toISOString().slice(0, 7);
    const m = months.find((x) => x.month === d);
    all.push({ month: d, count: m?.count ?? 0, total: Number(m?.total ?? 0) });
  }
  const stats: AppStats = {
    banjarActive: b.n,
    templeActive: t.active,
    templeOther: t.other,
    users: u.n,
    staff: st.n,
    months: all,
    perBanjar: (perBanjar as unknown as { banjar: string; temples: number; count: number; total: string | number }[]).map((r) => ({ ...r, total: Number(r.total) })),
  };
  return json({ ok: true, stats });
});
