import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { burnTime, createSession, loginLocked, verifyPassword } from "@/server/auth";
import { ApiError, assertSameOrigin, clientIp, json, readJson, route } from "@/server/http";
import { logActivity } from "@/server/log";

export const dynamic = "force-dynamic";
const GENERIC = "Email atau kata sandi salah.";

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const { email: raw, password } = z.object({ email: z.string().max(200), password: z.string().max(200) }).parse(await readJson(req));
  const email = raw.trim().toLowerCase();
  const ip = clientIp(req);
  const fail = async (reason: string, user?: { id: string; name: string }) => {
    await db.insert(schema.loginAttempts).values({ email, ip, success: false });
    await logActivity({ actor: { id: user?.id ?? null, name: user?.name ?? "Tidak dikenal", email }, action: "Login gagal", entity: "session", detail: reason, req });
  };

  if (await loginLocked(email, ip)) {
    await logActivity({ actor: { id: null, name: "Tidak dikenal", email }, action: "Login diblokir sementara", entity: "session", detail: "Terlalu banyak percobaan gagal (15 menit).", req });
    throw new ApiError(429, "Terlalu banyak percobaan gagal. Tunggu 15 menit lalu coba lagi.");
  }
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user) {
    await burnTime(password);
    await fail("Email tidak terdaftar");
    throw new ApiError(401, GENERIC);
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    await fail(user.passwordHash ? "Kata sandi salah" : "Akun belum diaktifkan", user);
    throw new ApiError(401, user.passwordHash ? GENERIC : "Akun ini belum diaktifkan. Buka tautan aktivasi dari Admin Utama.");
  }
  if (user.status !== "active") {
    await fail("Akun dinonaktifkan", user);
    throw new ApiError(403, "Akun Anda dinonaktifkan. Hubungi Admin Utama.");
  }
  await db.insert(schema.loginAttempts).values({ email, ip, success: true });
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  const [first] = await db.select().from(schema.memberships).where(and(eq(schema.memberships.userId, user.id), eq(schema.memberships.status, "active"))).limit(1);
  await createSession(user.id, req, first?.templeId ?? null);
  await logActivity({ actor: { id: user.id, name: user.name, email }, action: "Login berhasil", entity: "session", detail: user.isSuperAdmin ? "Admin Utama masuk" : "Pengurus masuk", req });
  return json({ ok: true });
});
