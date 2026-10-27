import { z } from "zod";
import { sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newToken, originOf, rateLimit, safeNext, sha256 } from "@/server/auth";
import { emailConfigured, layout, sendEmail } from "@/server/email";
import { ApiError, assertSameOrigin, clientIp, json, readJson, route } from "@/server/http";
import { logActivity } from "@/server/log";

export const dynamic = "force-dynamic";
const MINUTES = 15;

/**
 * Sends a one-time sign-in link (valid 15 minutes). Works for both registered staff and new Umat.
 * The response is the same whether or not the email is known.
 */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const i = z.object({ email: z.string().trim().toLowerCase().email("Format email belum benar").max(200), next: z.string().max(300).optional() }).parse(await readJson(req));
  await rateLimit(`emaillink-ip:${clientIp(req) ?? "unknown"}`, 10, 15);
  await rateLimit(`emaillink:${i.email}`, 3, 15);
  const [user] = await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${i.email}`);
  if (user?.status === "disabled") {
    await logActivity({ actor: { id: user.id, name: user.name, email: i.email }, action: "Tautan masuk ditolak", entity: "session", detail: "Akun dinonaktifkan", req });
    return json({ ok: true });
  }
  if (!emailConfigured() && process.env.NODE_ENV === "production")
    throw new ApiError(503, "Pengiriman email belum diatur oleh pengelola. Silakan masuk dengan Google.");

  const token = newToken();
  await db.insert(schema.passwordTokens).values({
    tokenHash: sha256(token), userId: user?.id ?? null, email: i.email, purpose: "login", expiresAt: new Date(Date.now() + MINUTES * 60_000),
  });
  const next = safeNext(i.next);
  const link = `${originOf(req)}/masuk/tautan?token=${token}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  await logActivity({ actor: { id: user?.id ?? null, name: user?.name ?? "Calon umat", email: i.email }, action: "Meminta tautan masuk", entity: "session", detail: "Tautan masuk dikirim ke email", req });

  if (!emailConfigured()) {
    // Local development without an email service: show the link on screen instead.
    console.info(`[PURA] Tautan masuk untuk ${i.email}: ${link}`);
    return json({ ok: true, devLink: link });
  }
  await sendEmail(
    i.email,
    "Tautan masuk PURA",
    layout({ title: "Masuk ke PURA", intro: `Ketuk tombol di bawah untuk masuk. Tautan ini berlaku ${MINUTES} menit dan hanya bisa dipakai sekali.`, button: { label: "Masuk ke PURA", url: link } }),
    `Masuk ke PURA: ${link}\n\nTautan berlaku ${MINUTES} menit dan hanya bisa dipakai sekali. Jika Anda tidak memintanya, abaikan email ini.`
  ).catch(async (e) => {
    console.error("[email]", e);
    throw new ApiError(502, "Email gagal dikirim. Coba lagi beberapa saat, atau masuk dengan Google.");
  });
  return json({ ok: true });
});
