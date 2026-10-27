import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "./db";
import { ApiError } from "./http";
import { requireCurrent, type CurrentSession } from "./auth";
import { ROLE_RANK, can, type Permission } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import { logActivity } from "./log";

export interface Ctx extends CurrentSession {
  req: Request;
  templeId: string | null;
  role: Role | undefined;
  actor: { id: string; name: string; email: string };
  /** Admin Utama has emergency mode switched on for ctx.templeId */
  emergency?: boolean;
  /** ctx.templeId is archived: everything can be read, nothing can be changed */
  templeArchived?: boolean;
}

/** Permissions that change a temple's data — refused while the temple is archived. */
const WRITE_PERMS = new Set<Permission>([
  "tx.create", "tx.draft", "tx.confirm", "tx.reverse", "donation.manage", "donation.correct",
  "campaign.manage", "activity.manage", "report.publish", "settings.manage",
]);

/** Admin Utama may change a temple's data only while emergency mode is on for that temple. */
export function emergencyActive(session: { emergencyTempleId: string | null; emergencyUntil: Date | null }, templeId: string | null) {
  return !!templeId && session.emergencyTempleId === templeId && !!session.emergencyUntil && session.emergencyUntil.getTime() > Date.now();
}

type UserRow = CurrentSession["user"];

/** Active banjar ids where the user is Pengurus Banjar. */
export async function banjarIdsOf(userId: string) {
  const rows = await db
    .select({ banjarId: schema.banjarMembers.banjarId })
    .from(schema.banjarMembers)
    .innerJoin(schema.banjars, eq(schema.banjars.id, schema.banjarMembers.banjarId))
    .where(and(eq(schema.banjarMembers.userId, userId), eq(schema.banjarMembers.status, "active"), eq(schema.banjars.status, "active")));
  return rows.map((r) => r.banjarId);
}

/**
 * Every temple this user may open, with the strongest role for each:
 * Admin Utama → all temples; Pengurus Pura/Pemeriksa → own memberships;
 * Pengurus Banjar → every temple the banjar supports (including temples shared with another banjar).
 */
export async function templeAccess(user: UserRow): Promise<Map<string, Role>> {
  const map = new Map<string, Role>();
  const put = (templeId: string, role: Role) => {
    const cur = map.get(templeId);
    if (!cur || ROLE_RANK[role] > ROLE_RANK[cur]) map.set(templeId, role);
  };
  if (user.isSuperAdmin) {
    const all = await db.select({ id: schema.temples.id }).from(schema.temples);
    all.forEach((t) => put(t.id, "superadmin"));
    return map;
  }
  const mems = await db
    .select()
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, user.id), eq(schema.memberships.status, "active")));
  mems.forEach((m) => put(m.templeId, m.role as Role));
  const banjarIds = await banjarIdsOf(user.id);
  if (banjarIds.length) {
    const tb = await db.select().from(schema.templeBanjars).where(inArray(schema.templeBanjars.banjarId, banjarIds));
    tb.forEach((r) => put(r.templeId, "banjar"));
  }
  return map;
}

export async function accessibleTemples(user: UserRow) {
  const access = await templeAccess(user);
  if (!access.size) return [];
  const rows = await db.select().from(schema.temples).where(inArray(schema.temples.id, Array.from(access.keys())));
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function roleFor(user: UserRow, templeId: string | null): Promise<Role | undefined> {
  if (!templeId) return undefined;
  if (user.isSuperAdmin) return "superadmin";
  return (await templeAccess(user)).get(templeId);
}

export async function getCtx(req: Request): Promise<Ctx> {
  const cur = await requireCurrent();
  const access = await templeAccess(cur.user);
  let templeId = cur.session.activeTempleId;
  if (!templeId || !access.has(templeId)) {
    // Active temple no longer accessible (or never chosen) — fall back to the first one available.
    templeId = Array.from(access.keys())[0] ?? null;
    if (templeId !== cur.session.activeTempleId)
      await db.update(schema.sessions).set({ activeTempleId: templeId }).where(eq(schema.sessions.id, cur.session.id));
  }
  let role = templeId ? access.get(templeId) : undefined;
  const emergency = cur.user.isSuperAdmin && emergencyActive(cur.session, templeId);
  if (cur.user.isSuperAdmin && templeId) role = emergency ? "superadmin" : "admin_view";
  const templeArchived = !!templeId && (await db.select({ status: schema.temples.status }).from(schema.temples).where(eq(schema.temples.id, templeId)))[0]?.status === "archived";
  return { ...cur, req, templeId, role, emergency, templeArchived, actor: { id: cur.user.id, name: cur.user.name, email: cur.user.email } };
}

export async function requirePerm(ctx: Ctx, perm: Permission, what = "melakukan tindakan ini") {
  if (ctx.templeArchived && WRITE_PERMS.has(perm))
    throw new ApiError(409, `Pura ini diarsipkan, jadi datanya hanya bisa dilihat dan tidak bisa ${what}. Admin Utama dapat mengaktifkannya kembali di Back Office.`);
  if (!can(ctx.role, perm)) {
    await logActivity({ actor: ctx.actor, action: "Akses ditolak", entity: "session", detail: `Mencoba ${what} tanpa izin (${perm})`, templeId: ctx.templeId, req: ctx.req });
    if (ctx.role === "admin_view")
      throw new ApiError(403, `Admin Utama sedang dalam mode lihat. Aktifkan "Mode darurat" (dengan alasan) di dashboard pura ini untuk ${what}.`);
    throw new ApiError(403, `Peran Anda tidak diizinkan untuk ${what}.`);
  }
}

export async function requireSuperAdmin(ctx: Ctx, what: string) {
  if (!ctx.user.isSuperAdmin) {
    await logActivity({ actor: ctx.actor, action: "Akses ditolak", entity: "session", detail: `Mencoba ${what} (khusus Admin Utama)`, req: ctx.req });
    throw new ApiError(403, `Hanya Admin Utama yang dapat ${what}.`);
  }
}

export function requireTemple(ctx: Ctx): string {
  if (!ctx.templeId) throw new ApiError(400, "Pilih pura terlebih dahulu.");
  return ctx.templeId;
}
