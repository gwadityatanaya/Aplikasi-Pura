import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { templeAccess } from "@/server/context";
import { pendingCounts } from "@/server/commands-punia";
import { emailConfigured, layout, sendEmail } from "@/server/email";
import { originOf } from "@/server/auth";
import { json, route } from "@/server/http";
import { logActivity } from "@/server/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily email summary for pengurus: "N punia menunggu verifikasi". Runs once a day (vercel.json
 * cron). At most one email per person per ~20 hours, and only when something is waiting.
 * Pengurus Banjar are told about temples that have no Pengurus Pura yet.
 */
export const GET = route(async (req: Request) => {
  // Email is optional: without SMTP the digest is simply off (the badge in the dashboard stays).
  if (!emailConfigured()) return json({ ok: true, sent: 0, note: "Email belum diatur — ringkasan harian nonaktif." });
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return json({ ok: false, error: "Tidak diizinkan." }, 401);

  const cutoff = new Date(Date.now() - 20 * 3600_000);
  const staff = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.status, "active"), eq(schema.users.emailDigest, true), or(isNull(schema.users.lastDigestAt), lt(schema.users.lastDigestAt, cutoff))));
  const temples = await db.select().from(schema.temples);
  const pengurusRows = await db.select().from(schema.memberships).where(and(eq(schema.memberships.role, "pengurus"), eq(schema.memberships.status, "active")));
  const counts = await pendingCounts(temples.map((t) => t.id));
  let sent = 0;
  for (const u of staff) {
    if (u.isSuperAdmin) continue; // Admin Utama sees everything in the Back Office
    const access = await templeAccess(u);
    const lines: { name: string; n: number }[] = [];
    for (const [templeId, role] of Array.from(access.entries())) {
      const n = counts.get(templeId) ?? 0;
      if (!n) continue;
      const hasPengurus = pengurusRows.some((p) => p.templeId === templeId);
      if (role === "pengurus" || (role === "banjar" && !hasPengurus)) lines.push({ name: temples.find((t) => t.id === templeId)?.name ?? "", n });
    }
    if (!lines.length) continue;
    const total = lines.reduce((s, l) => s + l.n, 0);
    const list = lines.map((l) => `<li style="font-size:17px;margin:6px 0">${l.name.replace(/[<>&]/g, "")}: <b>${l.n}</b> punia</li>`).join("");
    try {
      await sendEmail(
        u.email,
        `${total} punia menunggu verifikasi`,
        layout({ title: `${total} punia menunggu verifikasi`, intro: `Om Swastyastu ${u.callName}. Ada punia baru yang perlu dicocokkan dengan mutasi rekening:`, bodyHtml: `<ul>${list}</ul>`, button: { label: "Buka PURA", url: `${originOf(req)}/app/punia` }, footer: "Email ringkasan ini dikirim paling banyak sekali sehari. Matikan di Pengaturan → Notifikasi." }),
        `${total} punia menunggu verifikasi:\n${lines.map((l) => `- ${l.name}: ${l.n}`).join("\n")}\n\nBuka ${originOf(req)}/app/punia`
      );
      await db.update(schema.users).set({ lastDigestAt: new Date() }).where(eq(schema.users.id, u.id));
      sent++;
    } catch (e) {
      console.error("[digest]", u.email, e);
    }
  }
  if (sent) await logActivity({ actor: { id: null, name: "Sistem" }, action: "Mengirim email ringkasan", entity: "session", detail: `${sent} email ringkasan punia terkirim`, req });
  return json({ ok: true, sent });
});

