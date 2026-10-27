import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { createSession, rateLimit, safeEqual } from "@/server/auth";
import { ApiError, assertSameOrigin, clientIp, json, readJson, route } from "@/server/http";
import { logActivity } from "@/server/log";
import { uid } from "@/lib/format";

export const dynamic = "force-dynamic";

async function superAdminExists() {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.users).where(eq(schema.users.isSuperAdmin, true));
  return r.n > 0;
}

export const GET = route(async () => {
  const configured = !!process.env.SETUP_TOKEN && process.env.SETUP_TOKEN.length >= 16 && !!process.env.ADMIN_EMAIL;
  return json({ ok: true, done: await superAdminExists(), configured });
});

/**
 * One-time creation of the Admin Utama account (no password: Admin Utama signs in later with
 * Google or an email link using ADMIN_EMAIL). Requires the secret SETUP_TOKEN from the
 * server's environment and the email in ADMIN_EMAIL. Refuses forever once an Admin Utama exists.
 */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await rateLimit(`setup:${clientIp(req) ?? "unknown"}`, 5, 15);
  const i = z.object({ token: z.string().max(300), name: z.string().trim().min(3).max(120), email: z.string().trim().toLowerCase().email() }).parse(await readJson(req));
  const setupToken = process.env.SETUP_TOKEN ?? "";
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (setupToken.length < 16 || !adminEmail) throw new ApiError(503, "Setup belum dikonfigurasi. Isi SETUP_TOKEN dan ADMIN_EMAIL di pengaturan server.");
  if (!safeEqual(i.token.trim(), setupToken)) {
    await logActivity({ actor: { id: null, name: "Tidak dikenal", email: i.email }, action: "Setup Admin Utama gagal", entity: "session", detail: "Kode setup salah", req });
    throw new ApiError(403, "Kode setup salah.");
  }
  if (i.email !== adminEmail) throw new ApiError(403, "Email ini tidak terdaftar sebagai email Admin Utama di pengaturan server.");
  const id = uid("u");
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(424242)`);
    const [r] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.users).where(eq(schema.users.isSuperAdmin, true));
    if (r.n > 0) throw new ApiError(409, "Admin Utama sudah dibuat. Halaman setup tidak dapat dipakai lagi.");
    if ((await tx.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${i.email}`))[0]) throw new ApiError(409, "Email ini sudah dipakai akun lain. Hubungi pengembang.");
    const parts = i.name.split(/\s+/);
    await tx.insert(schema.users).values({ id, name: i.name, callName: parts[parts.length - 1], email: i.email, isSuperAdmin: true, avatarColor: "#17212B" });
    await logActivity({ actor: { id, name: i.name, email: i.email }, action: "Setup Admin Utama", entity: "user", entityId: id, detail: "Akun Admin Utama pertama dibuat melalui langkah setup", req }, tx);
  });
  await createSession(id, req);
  return json({ ok: true });
});
