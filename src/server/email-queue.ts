import "server-only";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db, schema as T, type Tx } from "./db";
import { esc, layout, puniaEmailEnabled, sendEmail } from "./email";
import { logActivity } from "./log";
import { formatDate, rupiah, uid } from "@/lib/format";

type DonationRow = typeof T.donations.$inferSelect;

/** Brevo Free sends 300 emails a day; some are kept for sign-in links and the daily digest. */
export function dailyCap() {
  const quota = Number(process.env.EMAIL_DAILY_QUOTA || 300);
  const reserve = Number(process.env.EMAIL_DAILY_RESERVE || 50);
  return Math.max(0, quota - reserve);
}
const TZ = () => process.env.APP_TIMEZONE || "Asia/Makassar";
const MAX_TRIES = 5;

const NOT_A_RECEIPT =
  "Email ini adalah konfirmasi PENCATATAN oleh pengurus pura di aplikasi PURA. Ini BUKAN kuitansi dan BUKAN bukti transaksi bank. Bukti pembayaran yang sah adalah catatan di m-banking/rekening Anda sendiri.";

const row = (label: string, value: string) =>
  `<tr><td style="padding:6px 12px 6px 0;color:#5F6B7A;font-size:15px;vertical-align:top">${esc(label)}</td><td style="padding:6px 0;font-size:16px;font-weight:bold">${esc(value)}</td></tr>`;

/**
 * Queues an email to the account that SENT this punia — in the same database transaction as the
 * decision. Only punia sent through the app (transfer/QRIS by the umat themself): never for punia
 * typed in by a pengurus. The email contains the person's own data only: no pengurus name, no full
 * account number, no proof image. Also marks the decision as "baru" in the umat's Punia Saya.
 */
export async function queuePuniaEmail(tx: Tx, kind: "punia_verified" | "punia_rejected", d: DonationRow, extra: { number?: string; reason?: string; origin?: string } = {}) {
  if (!d.submittedBy || d.inputBy || !["transfer", "qris"].includes(d.channel)) return;
  await tx.update(T.donations).set({ donorSeen: false }).where(eq(T.donations.id, d.id));
  if (!puniaEmailEnabled()) return;
  const [u] = await tx.select().from(T.users).where(eq(T.users.id, d.submittedBy));
  if (!u || u.status !== "active" || !u.emailPunia) return;
  const [t] = await tx.select({ name: T.temples.name }).from(T.temples).where(eq(T.temples.id, d.templeId));
  const campaign = d.campaignId ? (await tx.select({ title: T.campaigns.title }).from(T.campaigns).where(eq(T.campaigns.id, d.campaignId)))[0]?.title : undefined;
  const activity = d.activityId ? (await tx.select({ name: T.activities.name }).from(T.activities).where(eq(T.activities.id, d.activityId)))[0]?.name : undefined;
  const base = extra.origin ?? "";
  const url = `${base}/umat/punia`;
  const facts: [string, string][] = [
    ["Pura", t?.name ?? "-"],
    ["Nominal", rupiah(d.amount)],
    ["Tanggal transfer", formatDate(d.transferDate ?? d.date)],
    ...(campaign ? ([["Penggalangan dana", campaign]] as [string, string][]) : []),
    ...(activity ? ([["Kegiatan", activity]] as [string, string][]) : []),
  ];
  let subject: string;
  let title: string;
  let intro: string;
  let after = "";
  let text: string;
  if (kind === "punia_verified") {
    facts.push(["Status", "Disahkan"], ["Nomor catatan", extra.number ?? "-"], ["Tanggal pengesahan", formatDate(new Date())]);
    subject = `Punia Anda ke ${t?.name ?? "pura"} sudah disahkan`;
    title = "Punia Anda sudah disahkan";
    intro = "Suksma. Pengurus pura sudah mencocokkan dan mencatat punia Anda.";
    text = `${title}\n\n${facts.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${NOT_A_RECEIPT}\n\nLihat di aplikasi: ${url}`;
  } else {
    facts.push(["Status", "Ditolak"], ["Alasan", extra.reason ?? "-"]);
    subject = `Punia Anda ke ${t?.name ?? "pura"} perlu diperbaiki`;
    title = "Punia Anda belum bisa disahkan";
    intro = "Pengurus pura belum bisa mencocokkan punia Anda dengan mutasi rekening.";
    after = `<p style="font-size:16px;line-height:1.5">Cara memperbaiki: buka aplikasi PURA → <b>Punia Saya</b> → pilih punia ini → perbaiki nominal, tanggal, atau foto bukti → <b>Kirim ulang</b>.</p>`;
    text = `${title}\n\n${facts.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nCara memperbaiki: buka aplikasi PURA → Punia Saya → pilih punia ini → perbaiki → Kirim ulang.\n\n${NOT_A_RECEIPT}\n\n${url}`;
  }
  const html = layout({
    title,
    intro,
    bodyHtml: `<table style="margin:18px 0;border-collapse:collapse">${facts.map(([k, v]) => row(k, v)).join("")}</table>${after}<p style="margin:16px 0;padding:12px;border-radius:10px;background:#FEF3C7;font-size:14px;line-height:1.5;color:#7C4A03">${esc(NOT_A_RECEIPT)}</p>`,
    button: { label: "Buka Punia Saya", url },
    footer: "Anda menerima email ini karena mengirim punia lewat aplikasi PURA. Email ini bisa dimatikan di Akun saya → Email konfirmasi punia.",
  });
  await tx.insert(T.emailQueue).values({ id: uid("em"), kind, userId: u.id, donationId: d.id, toEmail: u.email, subject, html, textBody: text });
}

/**
 * Sends waiting emails, at most `max` per call and never more than the daily cap. When the cap is
 * reached the rest wait until tomorrow (nothing is dropped) and that is written in the Log once a
 * day. A failed email is retried later and never touches the punia itself.
 */
export async function processEmailQueue(max = 25) {
  const tz = TZ();
  const [{ n: sentToday }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(T.emailQueue)
    .where(sql`${T.emailQueue.sentAt} >= (date_trunc('day', now() at time zone ${tz}) at time zone ${tz})`);
  const room = dailyCap() - sentToday;
  if (room <= 0) {
    const moved = await db
      .update(T.emailQueue)
      .set({ notBefore: sql`(date_trunc('day', now() at time zone ${tz}) + interval '1 day 5 minutes') at time zone ${tz}` })
      .where(and(eq(T.emailQueue.status, "waiting"), lte(T.emailQueue.notBefore, sql`now()`)))
      .returning({ id: T.emailQueue.id });
    if (moved.length) {
      const [already] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(T.activityLog)
        .where(and(eq(T.activityLog.action, "Email konfirmasi punia ditunda"), sql`${T.activityLog.at} >= (date_trunc('day', now() at time zone ${tz}) at time zone ${tz})`));
      if (!already.n)
        await logActivity({ actor: { id: null, name: "Sistem" }, action: "Email konfirmasi punia ditunda", entity: "email", detail: `Kuota email harian (${dailyCap()}) tercapai; ${moved.length} email dikirim besok. Tidak ada yang dihapus.`, templeId: null });
    }
    return { sent: 0, postponed: moved.length };
  }
  let sent = 0;
  for (let i = 0; i < Math.min(max, room); i++) {
    // Claim one email (others running at the same time skip it).
    const claimed = await db.execute(sql`
      update email_queue set not_before = now() + interval '5 minutes', attempts = attempts + 1
      where id = (select id from email_queue where status = 'waiting' and not_before <= now() order by created_at limit 1 for update skip locked)
      returning id, to_email, subject, html, text_body, attempts, user_id`);
    const job = (claimed as unknown as { id: string; to_email: string; subject: string; html: string; text_body: string; attempts: number; user_id: string }[])[0];
    if (!job) break;
    const [u] = await db.select({ emailPunia: T.users.emailPunia, status: T.users.status }).from(T.users).where(eq(T.users.id, job.user_id));
    if (!u || !u.emailPunia || u.status !== "active") {
      await db.update(T.emailQueue).set({ status: "cancelled" }).where(eq(T.emailQueue.id, job.id));
      continue;
    }
    try {
      await sendEmail(job.to_email, job.subject, job.html, job.text_body);
      await db.update(T.emailQueue).set({ status: "sent", sentAt: new Date(), lastError: null }).where(eq(T.emailQueue.id, job.id));
      sent++;
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
      await db
        .update(T.emailQueue)
        .set({ lastError: msg, ...(job.attempts >= MAX_TRIES ? { status: "failed" } : { notBefore: sql`now() + make_interval(mins => ${10 * job.attempts})` }) })
        .where(eq(T.emailQueue.id, job.id));
    }
  }
  return { sent, postponed: 0 };
}

/** The person switched these emails off: drop what is still waiting for them. */
export async function cancelPuniaEmails(userId: string) {
  await db.update(T.emailQueue).set({ status: "cancelled" }).where(and(eq(T.emailQueue.userId, userId), inArray(T.emailQueue.status, ["waiting"])));
}
