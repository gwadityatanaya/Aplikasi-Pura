import "server-only";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "./db";
import { accessibleTemples, type Ctx } from "./context";
import * as m from "./map";
import type { DataState, Role, Session, User } from "@/lib/types";

export interface ServerState {
  me: User;
  role: Role | undefined;
  session: Session;
  data: DataState;
  registrationOpen: boolean;
}

/** Everything the signed-in user may see for their active temple. Never includes password hashes or tokens. */
export async function loadState(ctx: Ctx): Promise<ServerState> {
  const templeId = ctx.templeId;
  const temples = await accessibleTemples(ctx.user);
  const empty = { users: [], memberships: [], accounts: [], categories: [], activities: [], transactions: [], campaigns: [], donations: [], reports: [], notifications: [], audit: [] };
  let scoped: Omit<DataState, "version" | "temples" | "counters" | "resetRequests"> = { ...empty };
  if (templeId) {
    const [members, accounts, categories, activities, txs, campaigns, donations, reports, notifications, audit] = await Promise.all([
      db.select({ m: schema.memberships, u: schema.users }).from(schema.memberships).innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId)).where(eq(schema.memberships.templeId, templeId)),
      db.select().from(schema.accounts).where(eq(schema.accounts.templeId, templeId)),
      db.select().from(schema.categories).where(eq(schema.categories.templeId, templeId)),
      db.select().from(schema.activities).where(eq(schema.activities.templeId, templeId)),
      db.select().from(schema.transactions).where(eq(schema.transactions.templeId, templeId)),
      db.select().from(schema.campaigns).where(eq(schema.campaigns.templeId, templeId)),
      db.select().from(schema.donations).where(eq(schema.donations.templeId, templeId)),
      db.select().from(schema.reports).where(eq(schema.reports.templeId, templeId)).orderBy(desc(schema.reports.publishedAt)),
      db.select().from(schema.notifications).where(eq(schema.notifications.templeId, templeId)).orderBy(desc(schema.notifications.date)).limit(100),
      // Temple audit trail (business actions only — login records stay in the Admin Utama log).
      db.select().from(schema.activityLog).where(and(eq(schema.activityLog.templeId, templeId), ne(schema.activityLog.entity, "session"))).orderBy(desc(schema.activityLog.at)).limit(300),
    ]);
    // Names of people who created transactions but are no longer members.
    const extraIds = Array.from(new Set(txs.map((t) => t.createdBy))).filter((id) => !members.some((x) => x.u.id === id));
    const extra = extraIds.length ? await db.select().from(schema.users).where(inArray(schema.users.id, extraIds)) : [];
    scoped = {
      users: [...members.map((x) => m.toUser(x.u)), ...extra.map(m.toUser)],
      memberships: members.map((x) => m.toMembership(x.m)),
      accounts: accounts.map(m.toAccount),
      categories: categories.map(m.toCategory),
      activities: activities.map(m.toActivity),
      transactions: txs.map(m.toTx),
      campaigns: campaigns.map(m.toCampaign),
      donations: donations.map(m.toDonation),
      reports: reports.map(m.toReport),
      notifications: notifications.map(m.toNotification),
      audit: audit.map(m.toAudit),
    };
  }
  const me = m.toUser(ctx.user);
  if (!scoped.users.some((x) => x.id === me.id)) scoped.users.push(me);
  // The user's own memberships (for the temple switcher).
  const own = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, ctx.user.id));
  for (const o of own) if (!scoped.memberships.some((x) => x.id === o.id)) scoped.memberships.push(m.toMembership(o));

  return {
    me,
    role: ctx.role,
    session: { userId: ctx.user.id, activeTempleId: templeId ?? undefined, startedAt: ctx.session.createdAt.toISOString() },
    registrationOpen: process.env.ALLOW_REGISTRATION === "true",
    data: { version: 0, temples: temples.map(m.toTemple), counters: { tx: 0 }, resetRequests: [], ...scoped },
  };
}
