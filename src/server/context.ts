import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "./db";
import { ApiError } from "./http";
import { requireCurrent, type CurrentSession } from "./auth";
import { can, type Permission } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import { logActivity } from "./log";

export interface Ctx extends CurrentSession {
  req: Request;
  templeId: string | null;
  role: Role | undefined;
  actor: { id: string; name: string; email: string };
}

/** Temples this user may open: every temple for Admin Utama, otherwise active memberships. */
export async function accessibleTemples(user: CurrentSession["user"]) {
  if (user.isSuperAdmin) return db.select().from(schema.temples).orderBy(schema.temples.name);
  const rows = await db
    .select({ temple: schema.temples })
    .from(schema.memberships)
    .innerJoin(schema.temples, eq(schema.temples.id, schema.memberships.templeId))
    .where(and(eq(schema.memberships.userId, user.id), eq(schema.memberships.status, "active")));
  return rows.map((r) => r.temple).sort((a, b) => a.name.localeCompare(b.name));
}

export async function roleFor(user: CurrentSession["user"], templeId: string | null): Promise<Role | undefined> {
  if (user.isSuperAdmin) return "superadmin";
  if (!templeId) return undefined;
  const [m] = await db
    .select()
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, user.id), eq(schema.memberships.templeId, templeId), eq(schema.memberships.status, "active")))
    .limit(1);
  return m?.role as Role | undefined;
}

export async function getCtx(req: Request): Promise<Ctx> {
  const cur = await requireCurrent();
  let templeId = cur.session.activeTempleId;
  let role = await roleFor(cur.user, templeId);
  if (!role && !cur.user.isSuperAdmin) {
    // Active temple no longer accessible — fall back to the first one available.
    const list = await accessibleTemples(cur.user);
    templeId = list[0]?.id ?? null;
    role = await roleFor(cur.user, templeId);
    await db.update(schema.sessions).set({ activeTempleId: templeId }).where(eq(schema.sessions.id, cur.session.id));
  }
  if (cur.user.isSuperAdmin && !templeId) {
    const list = await accessibleTemples(cur.user);
    templeId = list[0]?.id ?? null;
  }
  return { ...cur, req, templeId, role, actor: { id: cur.user.id, name: cur.user.name, email: cur.user.email } };
}

export async function requirePerm(ctx: Ctx, perm: Permission, what = "melakukan tindakan ini") {
  if (!can(ctx.role, perm)) {
    await logActivity({ actor: ctx.actor, action: "Akses ditolak", entity: "session", detail: `Mencoba ${what} tanpa izin (${perm})`, templeId: ctx.templeId, req: ctx.req });
    throw new ApiError(403, `Peran Anda tidak diizinkan untuk ${what}.`);
  }
}

export function requireTemple(ctx: Ctx): string {
  if (!ctx.templeId) throw new ApiError(400, "Pilih pura terlebih dahulu.");
  return ctx.templeId;
}
