import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, schema } from "./db";
import { ApiError, clientIp, userAgent } from "./http";

export const SESSION_COOKIE = "pura_session";
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 12;

export const hashPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_ROUNDS);
export const verifyPassword = (pw: string, hash: string | null | undefined) => (hash ? bcrypt.compare(pw, hash) : Promise.resolve(false));
// A real hash checked for unknown emails, so every login takes about the same time.
let dummyHash: Promise<string> | null = null;
export const burnTime = async (pw: string) => {
  dummyHash ??= bcrypt.hash("pura-dummy-password-0", BCRYPT_ROUNDS);
  return bcrypt.compare(pw, await dummyHash);
};

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

export function passwordProblem(pw: string, email?: string): string | null {
  if (pw.length < 8) return "Kata sandi minimal 8 karakter.";
  if (pw.length > 128) return "Kata sandi terlalu panjang.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Kata sandi harus berisi huruf dan angka.";
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && pw.toLowerCase().includes(local)) return "Kata sandi jangan memuat nama email Anda.";
  if (/^(12345678|password1|qwerty123|pura12345)$/i.test(pw)) return "Kata sandi terlalu mudah ditebak.";
  return null;
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

/** Creates a one-time link for activating an account or resetting a password. */
export async function createPasswordLink(userId: string, purpose: "activation" | "reset", createdBy: string | null, origin: string) {
  const token = newToken();
  const hours = purpose === "activation" ? 72 : 24;
  await db.insert(schema.passwordTokens).values({
    tokenHash: sha256(token),
    userId,
    purpose,
    expiresAt: new Date(Date.now() + hours * 3600_000),
    createdBy,
  });
  return { link: `${origin}/atur-ulang-sandi?token=${token}`, hours };
}

export function originOf(req: Request) {
  const env = process.env.APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
