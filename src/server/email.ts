import "server-only";
import nodemailer from "nodemailer";

/**
 * Sends email through any SMTP service. Recommended: Brevo (free 300 emails/day).
 * Needs SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM in the environment.
 */
export function emailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.EMAIL_FROM);
}

let transporter: nodemailer.Transporter | null = null;
function transport() {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Simple, readable email layout (large text, one clear button). */
export function layout(o: { title: string; intro: string; button?: { label: string; url: string }; footer?: string; bodyHtml?: string }) {
  const btn = o.button
    ? `<p style="margin:28px 0"><a href="${esc(o.button.url)}" style="background:#087F6D;color:#fff;text-decoration:none;padding:16px 28px;border-radius:12px;font-weight:bold;font-size:18px;display:inline-block">${esc(o.button.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#FAF9F6;font-family:Arial,Helvetica,sans-serif;color:#17212B">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
<p style="font-size:20px;font-weight:bold;color:#064E3B;letter-spacing:3px;margin:0 0 20px">PURA</p>
<h1 style="font-size:22px;margin:0 0 12px;color:#064E3B">${esc(o.title)}</h1>
<p style="font-size:17px;line-height:1.5;margin:0">${esc(o.intro)}</p>
${o.bodyHtml ?? ""}${btn}
<p style="font-size:14px;color:#5F6B7A;line-height:1.5">${esc(o.footer ?? "Jika Anda tidak merasa meminta email ini, abaikan saja.")}</p>
</div></body></html>`;
}

export async function sendEmail(to: string, subject: string, html: string, textBody: string) {
  if (!emailConfigured()) throw new Error("EMAIL_NOT_CONFIGURED");
  await transport().sendMail({ from: process.env.EMAIL_FROM, to, subject, html, text: textBody });
}

/**
 * Which ways of signing in this server offers. Email (SMTP) and Google are both OPTIONAL:
 * without SMTP the email-link button is hidden and the daily digest is off; nothing else breaks.
 * On a laptop (development) the email link is shown on screen instead of being sent.
 */
export function signInOptions() {
  const google = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const smtp = emailConfigured();
  const devLinks = !smtp && process.env.NODE_ENV !== "production" && process.env.DEV_EMAIL_LINKS !== "false";
  return { google, email: smtp || devLinks, emailDev: devLinks, digest: smtp };
}
