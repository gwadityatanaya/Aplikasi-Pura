import { z } from "zod";
import { and, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { rateLimit } from "@/server/auth";
import { ApiError, assertSameOrigin, clientIp, json, readJson, route } from "@/server/http";
import { logActivity } from "@/server/log";
import { resolveAddress } from "@/server/wilayah";
import { uid } from "@/lib/format";
import { REGISTRATION_PER_DAY } from "@/lib/registration";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

const t = (max: number, min = 2, msg = "Wajib diisi") => z.string().trim().min(min, msg).max(max);
const code = z.string().trim().max(13).regex(/^[\d.]*$/).optional().nullable();
const input = z.object({
  banjarName: t(120, 3, "Isi nama banjar"),
  province: z.string().trim().max(100).default(""), regency: z.string().trim().max(100).default(""),
  district: z.string().trim().max(100).default(""), village: z.string().trim().max(100).default(""),
  provinceCode: code, regencyCode: code, districtCode: code, villageCode: code,
  templeName: t(120, 4, "Isi nama pura"),
  applicantName: t(120, 3, "Isi nama Anda"),
  applicantPosition: t(80, 2, "Isi jabatan Anda di banjar/pura"),
  whatsapp: z.string().trim().regex(/^(\+?62|0)8\d{7,12}$/, "Nomor WhatsApp belum benar (mis. 081234567890)"),
  googleEmail: z.string().trim().toLowerCase().email("Email belum benar").max(200),
  referrerName: t(120, 3, "Isi nama pemberi referensi"),
  referrerContact: t(120, 6, "Isi kontak pemberi referensi (WA atau email)"),
  reason: t(1000, 10, "Ceritakan singkat alasan mendaftar (minimal 10 huruf)"),
  consent: z.literal(true, { errorMap: () => ({ message: "Centang persetujuan penggunaan data" }) }),
  /** Honeypot: hidden from people; a bot that fills it is silently ignored. */
  website: z.string().max(200).optional(),
});

/**
 * "Ajukan pendaftaran" (public, no login). Only stored for Admin Utama to verify by hand — it never
 * creates an account, a role or any access. Limited per network per day and per phone/email.
 */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const i = input.parse(await readJson(req));
  if (i.website) return json({ ok: true }); // bot
  const ip = clientIp(req) ?? "unknown";
  try {
    await rateLimit(`daftar:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`, REGISTRATION_PER_DAY, 24 * 60);
  } catch {
    throw new ApiError(429, "Batas pengajuan dari jaringan ini untuk hari ini sudah tercapai. Coba lagi besok, atau hubungi Admin Utama.");
  }
  const wa = i.whatsapp.replace(/^\+?62/, "0");
  const [dup] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.registrationRequests)
    .where(and(inArray(schema.registrationRequests.status, ["baru", "verifikasi"]), or(sql`${schema.registrationRequests.whatsapp} = ${wa}`, sql`${schema.registrationRequests.googleEmail} = ${i.googleEmail}`)));
  if (dup.n) throw new ApiError(409, "Pengajuan dengan nomor WhatsApp atau email ini sudah kami terima dan sedang menunggu verifikasi. Tidak perlu mengirim ulang.");
  const address = resolveAddress({ province: i.province, regency: i.regency, district: i.district, village: i.village, provinceCode: i.provinceCode, regencyCode: i.regencyCode, districtCode: i.districtCode, villageCode: i.villageCode });
  const id = uid("reg");
  await db.insert(schema.registrationRequests).values({
    id, banjarName: i.banjarName, templeName: i.templeName, ...address, applicantName: i.applicantName, applicantPosition: i.applicantPosition,
    whatsapp: wa, googleEmail: i.googleEmail, referrerName: i.referrerName, referrerContact: i.referrerContact, reason: i.reason, consentAt: new Date(),
  });
  // The permanent log names the banjar and pura only — never the applicant's personal data.
  await logActivity({ actor: { id: null, name: "Publik (formulir pendaftaran)" }, action: "Pengajuan pendaftaran baru", entity: "registration", entityId: id, detail: `${i.banjarName} — ${i.templeName}`, templeId: null, req });
  return json({ ok: true });
});
