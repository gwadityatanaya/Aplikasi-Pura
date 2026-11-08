import { expect, request as pw, test } from "@playwright/test";
import postgres from "postgres";
import { command, publicData, receiptDataUrl, signInApi, today } from "./helpers";

// Phase 3.3 tahap 4 — confirmation email to the account that sent a punia (disahkan / ditolak),
// through a queue with a daily quota. The test server uses EMAIL_TEST_OUTBOX: emails are "sent"
// without a real email server; an address containing "gagal" fails on purpose.
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3100";
async function as(email: string, temple?: string) {
  const ctx = await pw.newContext({ baseURL: BASE });
  await signInApi(ctx, email);
  if (temple) expect((await command(ctx, "setActiveTemple", { templeId: temple })).ok).toBe(true);
  return ctx;
}
type Q = { id: string; status: string; to_email: string; subject: string; html: string; text_body: string; attempts: number; last_error: string | null; not_before: Date; kind: string };
const sql = () => postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
async function queueFor(donationId: string) {
  const db = sql();
  const rows = await db<Q[]>`select * from email_queue where donation_id = ${donationId} order by created_at`;
  await db.end();
  return rows;
}
const flush = async (ctx: Awaited<ReturnType<typeof as>>) => (await (await ctx.post("/api/email-queue", { headers: { origin: BASE } })).json()) as { sent: number; postponed: number };
let dalem = { id: "", name: "" };
let seed = 7000;
async function send(email: string, extra: Record<string, unknown> = {}) {
  const umat = await as(email);
  const r = await command<{ id: string }>(umat, "submitPunia", { templeId: dalem.id, amount: 50_000 + seed, transferDate: today(), evidence: receiptDataUrl(seed++), anonymous: false, purpose: "umum", ...extra });
  expect(r.ok, r.error).toBe(true);
  return { umat, id: r.value.id };
}

test("disahkan → email ke pengirim: data punianya sendiri, bukan kuitansi, tanpa nama pengurus/rekening lengkap/bukti", async () => {
  const t = (await publicData(await pw.newContext({ baseURL: BASE }))).temples.find((x) => x.name.endsWith("Pura Dalem Kahyangan"))!;
  dalem = { id: t.id, name: t.name };
  const { umat, id } = await send("ayu@contoh.id");
  const made = await as("made@contoh.id", dalem.id);
  const v = await command<{ verified: number }>(made, "verifyPunia", { ids: [id] });
  expect(v.value.verified).toBe(1);
  // Queued in the decision (sending happens afterwards; the server's occasional housekeeping may
  // already have sent it).
  expect(["waiting", "sent"]).toContain((await queueFor(id))[0].status);
  await flush(made);
  const [e] = await queueFor(id);
  expect(e.status).toBe("sent");
  expect(e.kind).toBe("punia_verified");
  expect(e.to_email).toBe("ayu@contoh.id");
  for (const s of [dalem.name, "Disahkan", "Nomor catatan", "Tanggal pengesahan", "Tanggal transfer", "BUKAN kuitansi", "BUKAN bukti transaksi bank"]) expect(e.html, s).toContain(s);
  expect(e.html).toMatch(/Rp\d/);
  expect(e.html).toMatch(/TRX-\d{4}-\d+/);
  expect(e.html).not.toContain("I Made Suarjana"); // who verified
  expect(e.html).not.toContain("000-000-0003"); // full account number
  expect(e.html).not.toContain("/api/attachments/"); // proof image
  // In the app too: "Baru" in Punia Saya until it is opened.
  const mine = (await (await umat.get("/api/umat")).json()).punia as { id: string; isNew?: boolean; status: string }[];
  expect(mine.find((d) => d.id === id)).toMatchObject({ status: "verified", isNew: true });
  await command(umat, "markMyPuniaSeen", {});
  expect(((await (await umat.get("/api/umat")).json()).punia as { id: string; isNew?: boolean }[]).find((d) => d.id === id)!.isNew).toBe(false);
});

test("ditolak → email berisi alasan dan cara mengirim ulang; alasan dengan data pribadi ditolak", async () => {
  const { id } = await send("ayu@contoh.id");
  const made = await as("made@contoh.id", dalem.id);
  const bad = await command(made, "rejectPunia", { id, reason: "Hubungi Pak Wayan di 081234567890" });
  expect(bad.ok).toBe(false);
  expect(bad.error).toMatch(/data pribadi/);
  expect((await command(made, "rejectPunia", { id, reason: "Nominal tidak sesuai mutasi rekening" })).ok).toBe(true);
  await flush(made);
  const [e] = await queueFor(id);
  expect(e).toMatchObject({ status: "sent", kind: "punia_rejected", to_email: "ayu@contoh.id" });
  expect(e.html).toContain("Nominal tidak sesuai mutasi rekening");
  expect(e.html).toContain("Kirim ulang");
  expect(e.html).toContain("Punia Saya");
});

test("punia input manual (donatur tanpa akun / dicatat pengurus) tidak mengirim email", async () => {
  const made = await as("made@contoh.id", dalem.id);
  const r = await command<{ id: string }>(made, "addManualPunia", { donorName: "Ni Luh Ayu Lestari (contoh)", donorEmail: "ayu@contoh.id", amount: 77_000, transferDate: today(), anonymous: false, purpose: "umum", channel: "tunai" });
  expect(r.ok, r.error).toBe(true);
  await flush(made);
  expect(await queueFor(r.value.id)).toHaveLength(0);
});

test("donatur anonim: email hanya ke akunnya sendiri dan hanya berisi datanya sendiri", async () => {
  const { id } = await send("kadek@contoh.id", { anonymous: true });
  const made = await as("made@contoh.id", dalem.id);
  await command(made, "verifyPunia", { ids: [id] });
  await flush(made);
  const rows = await queueFor(id);
  expect(rows).toHaveLength(1);
  expect(rows[0].to_email).toBe("kadek@contoh.id");
  for (const other of ["Ni Luh Ayu Lestari", "I Nyoman Darma", "Keluarga I Ketut Rai"]) expect(rows[0].html).not.toContain(other);
});

test("pengesahan massal tetap berhasil walau satu email gagal; email gagal dicoba lagi nanti", async () => {
  const a = await send("ayu@contoh.id");
  const b = await send("umat.gagal@contoh.id");
  const made = await as("made@contoh.id", dalem.id);
  const v = await command<{ verified: number }>(made, "verifyPunia", { ids: [a.id, b.id] });
  expect(v.ok).toBe(true);
  expect(v.value.verified).toBe(2);
  await flush(made);
  expect((await queueFor(a.id))[0].status).toBe("sent");
  const [failed] = await queueFor(b.id);
  expect(failed.status).toBe("waiting"); // will be retried
  expect(failed.attempts).toBe(1);
  expect(failed.last_error).toBeTruthy();
  const st = (await (await made.get("/api/state")).json()).state.data.donations as { id: string; status: string }[];
  expect(st.find((d) => d.id === b.id)!.status).toBe("verified");
});

test("email bisa dimatikan; kuota harian habis → ditunda ke besok dan dicatat, tidak hilang", async () => {
  // Switched off → nothing is queued.
  const ayu = await as("ayu@contoh.id");
  expect((await command(ayu, "updateUser", { emailPunia: false })).ok).toBe(true);
  const off = await send("ayu@contoh.id");
  const made = await as("made@contoh.id", dalem.id);
  await command(made, "verifyPunia", { ids: [off.id] });
  expect(await queueFor(off.id)).toHaveLength(0);
  expect((await command(ayu, "updateUser", { emailPunia: true })).ok).toBe(true);

  // Quota reached today → postponed to tomorrow, logged once, still waiting.
  const db = sql();
  await db`insert into email_queue (id, kind, user_id, to_email, subject, html, text_body, status, sent_at)
           select 'em_kuota_' || g, 'punia_verified', 'x', 'x@contoh.id', 's', 'h', 't', 'sent', now() from generate_series(1, 260) g`;
  const p = await send("ayu@contoh.id");
  await command(made, "verifyPunia", { ids: [p.id] });
  const r = await flush(made);
  expect(r.sent).toBe(0);
  const [e] = await queueFor(p.id);
  expect(e.status).toBe("waiting");
  expect(new Date(e.not_before).getTime()).toBeGreaterThan(Date.now() + 60_000);
  const log = await (await (await as("admin@contoh.id")).get("/api/admin/log")).text();
  expect(log).toContain("Email konfirmasi punia ditunda");
  await db`delete from email_queue where id like 'em_kuota_%'`;
  await db.end();
});
