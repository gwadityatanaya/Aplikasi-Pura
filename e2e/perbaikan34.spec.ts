import { expect, request as pw, test } from "@playwright/test";
import postgres from "postgres";
import { command, publicData, signInApi, signInUi, today } from "./helpers";

// Phase 3.4 tahap 1 — manual punia: which bank account or "Tunai"; the monthly check by a Pengurus
// Banjar (not by a Pemeriksa); failed punia emails shown in the Back Office.
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3100";
async function as(email: string, temple?: string) {
  const ctx = await pw.newContext({ baseURL: BASE });
  await signInApi(ctx, email);
  if (temple) expect((await command(ctx, "setActiveTemple", { templeId: temple })).ok).toBe(true);
  return ctx;
}
const sql = () => postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
type Acc = { id: string; type: string; archived?: boolean };
let dalem = "";

test("input punia manual: pilih rekening atau Tunai; tersimpan, dibukukan ke situ, dan tampil di laporan", async ({ page }) => {
  const temples = (await publicData(await pw.newContext({ baseURL: BASE }))).temples;
  dalem = temples.find((t) => t.name.endsWith("Pura Dalem Kahyangan"))!.id;
  const made = await as("made@contoh.id", dalem);
  const st = (await (await made.get("/api/state")).json()).state;
  const cash = (st.data.accounts as Acc[]).find((a) => a.type === "cash" && !a.archived)!;
  const bank = (st.data.accounts as Acc[]).find((a) => a.type === "bank" && !a.archived)!;

  // The screen offers the bank account(s) and "Tunai"; cash received → Tunai by default.
  await signInUi(page, "made@contoh.id");
  await command(page.request, "setActiveTemple", { templeId: dalem });
  await page.goto("/app/punia?input=1");
  const into = page.getByLabel("Masuk ke");
  await expect(into.locator("option", { hasText: "Tunai (kas pura" })).toBeAttached();
  await expect(into).toHaveValue(cash.id);
  await page.getByLabel("Diterima lewat").selectOption("transfer");
  await expect(into).toHaveValue(bank.id);

  const base = { donorName: "Keluarga I Wayan Sudra (contoh)", transferDate: today(), anonymous: false, purpose: "umum" };
  const toCash = await command<{ id: string; verified: boolean }>(made, "addManualPunia", { ...base, amount: 61_000, channel: "whatsapp", accountId: cash.id });
  expect(toCash.ok, toCash.error).toBe(true);
  const toBank = await command<{ id: string }>(made, "addManualPunia", { ...base, amount: 62_000, channel: "transfer", accountId: bank.id });
  expect(toBank.ok, toBank.error).toBe(true);
  expect((await command(made, "addManualPunia", { ...base, amount: 63_000, channel: "tunai", accountId: "acc_bukan_milik_pura" })).ok).toBe(false);

  const after = (await (await made.get("/api/state")).json()).state.data;
  const txOf = (id: string) => {
    const d = (after.donations as { id: string; accountId?: string; transactionId?: string }[]).find((x) => x.id === id)!;
    return { d, t: (after.transactions as { id: string; accountId: string }[]).find((t) => t.id === d.transactionId)! };
  };
  expect(txOf(toCash.value.id).d.accountId).toBe(cash.id);
  expect(txOf(toCash.value.id).t.accountId).toBe(cash.id); // booked to the cash box, even though it came by WhatsApp
  expect(txOf(toBank.value.id).t.accountId).toBe(bank.id);

  // Punia report: "Masuk ke" column.
  await page.goto("/app/laporan");
  await page.locator("#r-type").selectOption("punia");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "CSV" }).click()]);
  const csv = Buffer.concat(await (await dl.createReadStream()).toArray()).toString("utf8");
  expect(csv).toContain("Masuk ke");
  expect(csv).toMatch(/Keluarga I Wayan Sudra \(contoh\).*Tunai \(kas\).*61000/);
});

test("pencocokan bulanan: Pengurus Banjar boleh (tercatat), Pemeriksa tidak", async () => {
  const temples = (await publicData(await pw.newContext({ baseURL: BASE }))).temples;
  const melanting = temples.find((t) => t.name.endsWith("Pura Melanting Pasar"))!.id; // no Pengurus Pura
  const banjar = await as("ketut.banjar@contoh.id", melanting);
  const acc = ((await (await banjar.get("/api/state")).json()).state.data.accounts as Acc[]).find((a) => a.type === "cash")!;
  const r = await command(banjar, "saveReconciliation", { month: today().slice(0, 7), items: [{ accountId: acc.id, statementBalance: 0, note: "Dihitung Kelian Banjar" }] });
  expect(r.ok, r.error).toBe(true);
  const audit = JSON.stringify((await (await banjar.get("/api/state")).json()).state.data.audit);
  expect(audit).toContain("Mencatat pencocokan bulanan");
  expect(audit).toContain("I Ketut Wirawan");

  const oka = await as("oka.pemeriksa@contoh.id", dalem);
  const cashD = ((await (await oka.get("/api/state")).json()).state.data.accounts as Acc[]).find((a) => a.type === "cash")!;
  expect((await command(oka, "saveReconciliation", { month: today().slice(0, 7), items: [{ accountId: cashD.id, statementBalance: 0 }] })).ok).toBe(false);
});

test("Back Office memperingatkan email konfirmasi yang gagal terkirim", async ({ page }) => {
  const db = sql();
  await db`insert into email_queue (id, kind, user_id, to_email, subject, html, text_body, status, attempts) values ('em_uji_gagal', 'punia_verified', 'x', 'x@contoh.id', 's', 'h', 't', 'failed', 5)`;
  await signInUi(page, "admin@contoh.id");
  await page.goto("/app/admin");
  await expect(page.getByText(/email konfirmasi punia\s*gagal terkirim/)).toBeVisible();
  await db`delete from email_queue where id = 'em_uji_gagal'`;
  await db.end();
});
