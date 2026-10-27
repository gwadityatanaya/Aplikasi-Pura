import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { callNameOf, uid } from "@/lib/format";
import { logActivity } from "./log";
import { db, schema } from "./db";
import { ApiError, clientIp, userAgent } from "./http";

export const SESSION_COOKIE = "pura_session";
const SESSION_DAYS = 30;

export function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}
export function newToken() {
  return randomBytes(32).toString("base64url");
}
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(sha256(a));
  const y = Buffer.from(sha256(b));
  return timingSafeEqual(x, y);
}

export async function createSession(userId: string, req: Request, activeTempleId?: string | null) {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(schema.sessions).values({
    id: sha256(token),
    userId,
    activeTempleId: activeTempleId ?? null,
    expiresAt: expires,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  cookies().delete(SESSION_COOKIE);
}

export type SessionUser = typeof schema.users.$inferSelect;
export type CurrentSession = { session: typeof schema.sessions.$inferSelect; user: SessionUser };

/** Returns the signed-in user, or null. Disabled accounts and expired sessions count as signed out. */
export async function getCurrent(): Promise<CurrentSession | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || row.user.status !== "active") return null;
  // Sliding expiry, refreshed at most once per hour.
  if (Date.now() - row.session.lastSeenAt.getTime() > 3600_000) {
    const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
    await db.update(schema.sessions).set({ lastSeenAt: new Date(), expiresAt: expires }).where(eq(schema.sessions.id, row.session.id));
  }
  return row;
}

export async function requireCurrent() {
  const cur = await getCurrent();
  if (!cur) throw new ApiError(401, "Sesi Anda telah berakhir. Silakan masuk kembali.");
  return cur;
}

/** Login throttling: 5 failures per email or 20 per IP within 15 minutes. */
export async function loginLocked(email: string, ip: string | null) {
  const since = new Date(Date.now() - 15 * 60_000);
  const [byEmail] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.loginAttempts)
    .where(and(eq(schema.loginAttempts.email, email), eq(schema.loginAttempts.success, false), gt(schema.loginAttempts.at, since)));
  if (byEmail.n >= 5) return true;
  if (ip) {
    const [byIp] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.loginAttempts)
      .where(and(eq(schema.loginAttempts.ip, ip), eq(schema.loginAttempts.success, false), gt(schema.loginAttempts.at, since)));
    if (byIp.n >= 20) return true;
  }
  return false;
}

/** Generic per-bucket rate limit stored in the database (works on serverless). */
export async function rateLimit(bucket: string, max: number, windowMinutes: number) {
  const since = new Date(Date.now() - windowMinutes * 60_000);
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.rateLimits)
    .where(and(eq(schema.rateLimits.bucket, bucket), gt(schema.rateLimits.at, since)));
  if (r.n >= max) throw new ApiError(429, "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.");
  await db.insert(schema.rateLimits).values({ bucket });
}

export function originOf(req: Request) {
  const env = process.env.APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Only same-site paths are allowed as a destination after signing in. */
export function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next.slice(0, 300) : null;
}

/**
 * Signs someone in by a verified email address (from Google or a one-time email link).
 * Emails are matched without regard to upper/lower case. Unknown emails become a new Umat account.
 */
export async function signInWithEmail(req: Request, input: { email: string; method: "google" | "email"; googleSub?: string; name?: string }) {
  const email = input.email.trim().toLowerCase();
  const ip = clientIp(req);
  const how = input.method === "google" ? "Google" : "tautan email";
  if (await loginLocked(email, ip)) {
    await logActivity({ actor: { id: null, name: "Tidak dikenal", email }, action: "Login diblokir sementara", entity: "session", detail: "Terlalu banyak percobaan gagal (15 menit).", req });
    throw new ApiError(429, "Terlalu banyak percobaan gagal. Tunggu 15 menit lalu coba lagi.");
  }
  const fail = async (detail: string, user?: { id: string; name: string }) => {
    await db.insert(schema.loginAttempts).values({ email, ip, success: false });
    await logActivity({ actor: { id: user?.id ?? null, name: user?.name ?? "Tidak dikenal", email }, action: "Login gagal", entity: "session", detail: `${detail} (${how})`, req });
  };

  let [user] = await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${email}`);
  if (!user && input.googleSub) [user] = await db.select().from(schema.users).where(eq(schema.users.googleSub, input.googleSub));
  if (user && user.status === "disabled") {
    await fail("Akun dinonaktifkan", user);
    throw new ApiError(403, "Akun Anda dinonaktifkan. Hubungi Admin Utama.");
  }
  if (user && input.googleSub && user.googleSub && user.googleSub !== input.googleSub) {
    await fail("Akun Google berbeda dengan yang pernah dipakai untuk email ini", user);
    throw new ApiError(403, "Akun Google ini tidak cocok dengan akun yang terdaftar. Gunakan tautan masuk lewat email.");
  }
  if (!user) {
    if (process.env.UMAT_REGISTRATION === "false") {
      await fail("Email belum terdaftar (pendaftaran umat ditutup)");
      throw new ApiError(403, "Pendaftaran umat sedang ditutup. Hubungi pengurus pura.");
    }
    const name = (input.name?.trim() || email.split("@")[0]).slice(0, 120);
    [user] = await db
      .insert(schema.users)
      .values({ id: uid("u"), name, callName: callNameOf(name), email, googleSub: input.googleSub ?? null, avatarColor: "#3F6FB5" })
      .returning();
    await logActivity({ actor: { id: user.id, name: user.name, email }, action: "Mendaftar sebagai umat", entity: "user", entityId: user.id, detail: `Pendaftaran mandiri lewat ${how}`, req });
  }
  const patch: Partial<typeof schema.users.$inferInsert> = { lastLoginAt: new Date() };
  if (input.googleSub && !user.googleSub) patch.googleSub = input.googleSub;
  if (input.name && user.name === user.email.split("@")[0]) patch.name = input.name.slice(0, 120);
  await db.update(schema.users).set(patch).where(eq(schema.users.id, user.id));
  await db.insert(schema.loginAttempts).values({ email, ip, success: true });
  const { templeAccess } = await import("./context");
  const access = await templeAccess({ ...user, ...patch } as typeof user);
  await createSession(user.id, req, Array.from(access.keys())[0] ?? null);
  await logActivity({ actor: { id: user.id, name: user.name, email }, action: "Login berhasil", entity: "session", detail: `${user.isSuperAdmin ? "Admin Utama" : access.size ? "Pengurus" : "Umat"} masuk lewat ${how}`, req });
  return { isStaff: user.isSuperAdmin || access.size > 0 };
}
