import { READ_ONLY_ROLES } from "@/lib/permissions";
import "server-only";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "./db";
import { helpCounts } from "./commands-help";
import { banjarIdsOf, emergencyActive, templeAccess, type Ctx } from "./context";
import * as m from "./map";
import type { DataState, Donation, Role, Session, User } from "@/lib/types";

export interface ServerState {
  me: User;
  role: Role | undefined;
  access: { isSuperAdmin: boolean; isStaff: boolean; banjarIds: string[]; emergency: { templeId: string; until: string; reason: string } | null; help: { unread: number; inbox: number } };
  session: Session;
  data: DataState;
}

/** Flags punia that share amount + transfer date with another non-rejected punia of the same temple. */
export function markDuplicates(list: Donation[]) {
  const seen = new Map<string, number>();
  for (const d of list) {
    if (d.status === "rejected" || !d.transferDate) continue;
    const k = `${d.amount}|${d.transferDate}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return list.map((d) => (d.status !== "rejected" && d.transferDate && (seen.get(`${d.amount}|${d.transferDate}`) ?? 0) > 1 ? { ...d, possibleDuplicate: true } : d));
}

/**
 * Adds "dicatat oleh" / "dikoreksi oleh" names for staff. Real names of ANONIM donors are for the
 * temple's pengurus, the related Pengurus Banjar and Admin Utama only — a Pemeriksa sees "Anonim".
 */
function staffDonation(d: Donation, people: Map<string, User>, role: Role | undefined): Donation {
  const out: Donation = { ...d, inputByName: d.inputBy ? people.get(d.inputBy)?.name : undefined, correctedByName: d.correctedBy ? people.get(d.correctedBy)?.name : undefined };
  if (role && READ_ONLY_ROLES.includes(role) && d.privacy !== "public") return { ...out, donorName: "Anonim", submitterEmail: undefined, message: undefined };
  return out;
}

/**
 * Everything the signed-in user may see. Staff get the full workspace of their active temple;
 * Umat get only their own account (their punia history comes from /api/umat). Never includes
 * password hashes, Google ids or tokens.
 */
export async function loadState(ctx: Ctx): Promise<ServerState> {
  const access = await templeAccess(ctx.user);
  const banjarIds = ctx.user.isSuperAdmin ? [] : await banjarIdsOf(ctx.user.id);
  const templeIds = Array.from(access.keys());
  const templeId = ctx.templeId && access.has(ctx.templeId) ? ctx.templeId : null;

  const [templeRows, tbRows, pengurusRows, pendingRows] = templeIds.length
    ? await Promise.all([
        db.select().from(schema.temples).where(inArray(schema.temples.id, templeIds)),
        db.select().from(schema.templeBanjars).where(inArray(schema.templeBanjars.templeId, templeIds)),
        db.select().from(schema.memberships).where(and(inArray(schema.memberships.templeId, templeIds), eq(schema.memberships.role, "pengurus"), eq(schema.memberships.status, "active"))),
        db
          .select({ templeId: schema.donations.templeId, n: sql<number>`count(*)::int` })
          .from(schema.donations)
          .where(and(inArray(schema.donations.templeId, templeIds), eq(schema.donations.status, "pending")))
          .groupBy(schema.donations.templeId),
      ])
    : [[], [], [], []];
  const relevantBanjarIds = Array.from(new Set([...tbRows.map((r) => r.banjarId), ...banjarIds]));
  const banjarRows = relevantBanjarIds.length ? await db.select().from(schema.banjars).where(inArray(schema.banjars.id, relevantBanjarIds)) : [];
  const temples = templeRows
    .map((t) => ({
      ...m.toTemple(t),
      banjarIds: tbRows.filter((r) => r.templeId === t.id).map((r) => r.banjarId),
      pengurusCount: pengurusRows.filter((p) => p.templeId === t.id).length,
      pendingCount: pendingRows.find((p) => p.templeId === t.id)?.n ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const empty = { users: [], memberships: [], accounts: [], categories: [], activities: [], transactions: [], campaigns: [], donations: [], reports: [], notifications: [], audit: [], banjarMembers: [] };
  let scoped: Omit<DataState, "version" | "temples" | "banjars" | "templeBanjars" | "counters" | "resetRequests"> = { ...empty };
  if (templeId) {
    const templeBanjarIds = tbRows.filter((r) => r.templeId === templeId).map((r) => r.banjarId);
    const [members, banjarMembers, accounts, categories, activities, txs, campaigns, donations, reports, notifications, audit] = await Promise.all([
      db.select({ m: schema.memberships, u: schema.users }).from(schema.memberships).innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId)).where(eq(schema.memberships.templeId, templeId)),
      templeBanjarIds.length
        ? db.select({ b: schema.banjarMembers, u: schema.users }).from(schema.banjarMembers).innerJoin(schema.users, eq(schema.users.id, schema.banjarMembers.userId)).where(inArray(schema.banjarMembers.banjarId, templeBanjarIds))
        : Promise.resolve([]),
      db.select().from(schema.accounts).where(eq(schema.accounts.templeId, templeId)),
      db.select().from(schema.categories).where(eq(schema.categories.templeId, templeId)),
      db.select().from(schema.activities).where(eq(schema.activities.templeId, templeId)),
      db.select().from(schema.transactions).where(eq(schema.transactions.templeId, templeId)),
      db.select().from(schema.campaigns).where(eq(schema.campaigns.templeId, templeId)),
      db.select().from(schema.donations).where(eq(schema.donations.templeId, templeId)),
      db.select().from(schema.reports).where(eq(schema.reports.templeId, templeId)).orderBy(desc(schema.reports.publishedAt)),
      db.select().from(schema.notifications).where(eq(schema.notifications.templeId, templeId)).orderBy(desc(schema.notifications.date)).limit(100),
      // Riwayat Audit Pura: business actions only — login records stay in the Admin Utama log.
      db.select().from(schema.activityLog).where(and(eq(schema.activityLog.templeId, templeId), ne(schema.activityLog.entity, "session"))).orderBy(desc(schema.activityLog.at)).limit(300),
    ]);
    // Profile photos of this temple's active staff, only for Pengurus Pura / Pengurus Banjar / Admin
    // Utama (the same rule as /api/avatar). Everyone else gets initials.
    const viewerRole = access.get(templeId);
    const seePhotos = ctx.user.isSuperAdmin || viewerRole === "pengurus" || viewerRole === "banjar";
    const staffUser = (u: typeof schema.users.$inferSelect, active: boolean) => {
      const x = m.toUser(u);
      return seePhotos && active ? x : { ...x, avatarVersion: undefined };
    };
    const people = new Map<string, User>();
    members.forEach((x) => people.set(x.u.id, staffUser(x.u, x.m.status === "active")));
    banjarMembers.forEach((x) => people.set(x.u.id, staffUser(x.u, x.b.status === "active")));
    // Names of people who recorded entries but are no longer staff (no photo).
    const extraIds = Array.from(new Set([...txs.map((t) => t.createdBy), ...donations.flatMap((d) => [d.verifiedBy, d.inputBy, d.correctedBy]).filter(Boolean)] as string[])).filter((id) => !people.has(id));
    if (extraIds.length) (await db.select().from(schema.users).where(inArray(schema.users.id, extraIds))).forEach((u) => people.set(u.id, staffUser(u, false)));
    scoped = {
      users: Array.from(people.values()),
      memberships: members.map((x) => m.toMembership(x.m)),
      banjarMembers: banjarMembers.map((x) => m.toBanjarMember(x.b)),
      accounts: accounts.map(m.toAccount),
      categories: categories.map(m.toCategory),
      activities: activities.map(m.toActivity),
      transactions: txs.map(m.toTx),
      campaigns: campaigns.map(m.toCampaign),
      donations: markDuplicates(donations.map((r) => staffDonation(m.toDonation(r), people, access.get(templeId)))),
      reports: reports.map(m.toReport),
      notifications: notifications.map(m.toNotification),
      audit: audit.map(m.toAudit),
    };
  }
  const me = { ...m.toUser(ctx.user), notice: ctx.user.notice ?? undefined };
  scoped.users = [...scoped.users.filter((x) => x.id !== me.id), me];

  // Admin Utama: read-only ("admin_view") unless emergency mode is on for this temple.
  let role = templeId ? access.get(templeId) : undefined;
  let emergency: ServerState["access"]["emergency"] = null;
  if (ctx.user.isSuperAdmin && templeId) {
    const [sess] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, ctx.session.id));
    const on = !!sess && emergencyActive(sess, templeId);
    role = on ? "superadmin" : "admin_view";
    if (on) emergency = { templeId, until: sess.emergencyUntil!.toISOString(), reason: sess.emergencyReason ?? "" };
  }

  return {
    me,
    role,
    access: { isSuperAdmin: ctx.user.isSuperAdmin, isStaff: ctx.user.isSuperAdmin || access.size > 0, banjarIds, emergency, help: await helpCounts(ctx.user) },
    session: { userId: ctx.user.id, activeTempleId: templeId ?? undefined, startedAt: ctx.session.createdAt.toISOString() },
    data: {
      version: 0,
      temples,
      banjars: banjarRows.map(m.toBanjar),
      templeBanjars: tbRows.map((r) => ({ templeId: r.templeId, banjarId: r.banjarId })),
      counters: { tx: 0 },
      resetRequests: [],
      ...scoped,
    },
  };
}
