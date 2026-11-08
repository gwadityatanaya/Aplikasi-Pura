import { expect, request as pw, test } from "@playwright/test";
import { command, publicData, receipt, receiptDataUrl, signInApi, signInUi, today } from "./helpers";

// Phase 3.3 tahap 3 — several bank accounts per temple (Admin Utama only), umat choose the one
// they paid into, balance per account, deactivating keeps history, QRIS set by Admin Utama only.
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3100";
type Bank = { id: string; label: string; bankName: string; accountNumber: string; accountHolder: string; isPrimary: boolean };
type PubTemple = { id: string; slug: string; name: string; bankAccounts?: Bank[]; qrisImage?: string; qrisAccountId?: string };
async function as(email: string, temple?: string) {
  const ctx = await pw.newContext({ baseURL: BASE });
  await signInApi(ctx, email);
  if (temple) expect((await command(ctx, "setActiveTemple", { templeId: temple })).ok).toBe(true);
  return ctx;
}
const pub = async (name: string) => ((await (await (await pw.newContext({ baseURL: BASE })).get("/api/public")).json()).data.temples as PubTemple[]).find((t) => t.name.endsWith(name))!;
const state = async (ctx: Awaited<ReturnType<typeof as>>) => (await (await ctx.get("/api/state")).json()).state;
let segara: PubTemple;
let second = "";

test("pura dengan satu rekening tetap seperti dulu (rekening lama otomatis menjadi utama)", async ({ page }) => {
  const desa = await pub("Pura Desa Sukamerta");
  expect(desa.bankAccounts).toHaveLength(1);
  expect(desa.bankAccounts![0].isPrimary).toBe(true);
  await signInUi(page, "ayu@contoh.id");
  await page.goto(`/pura/${desa.slug}/punia`);
  await expect(page.getByText(desa.bankAccounts![0].accountNumber)).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Rekening tujuan" })).toHaveCount(0);
  const r = await command<{ id: string; accountId?: string }>(page.request, "submitPunia", { templeId: desa.id, amount: 31_500, transferDate: today(), evidence: receiptDataUrl(6101), anonymous: false, purpose: "umum" });
  expect(r.ok, r.error).toBe(true);
  expect(r.value.accountId).toBe(desa.bankAccounts![0].id);
});

test("hanya Admin Utama yang menambah rekening (tercatat); pengurus ditolak", async ({ page }) => {
  segara = await pub("Pura Segara Bersama");
  const made = await as("made@contoh.id", segara.id);
  expect((await command(made, "adminSaveBankAccount", { templeId: segara.id, label: "Pembangunan", bankName: "Bank X", accountNumber: "111", accountHolder: "Siapa saja" })).ok).toBe(false);
  const asCash = await command(made, "saveAccount", { name: "Rekening Diam-diam", type: "bank", openingBalance: 0, openingDate: today() });
  expect(asCash.ok).toBe(false);
  expect(asCash.error).toMatch(/Admin Utama/);

  await signInUi(page, "admin@contoh.id");
  await page.goto("/app/admin");
  await page.locator("li").filter({ hasText: "CONTOH Pura Segara Bersama" }).getByRole("button", { name: "Rekening" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.locator("#bk-label").fill("Pembangunan");
  await dlg.locator("#bk-name").fill("Bank CONTOH Pembangunan (fiktif)");
  await dlg.locator("#bk-no").fill("000-111-222");
  await dlg.locator("#bk-holder").fill("Panitia Pembangunan Pura Segara (contoh)");
  await dlg.getByRole("button", { name: "Simpan rekening" }).click();
  await page.getByRole("button", { name: "Ya, simpan" }).click();
  await expect(page.getByText("Rekening disimpan")).toBeVisible();
  await expect(dlg.getByRole("list", { name: "Daftar rekening" })).toContainText("Pembangunan");

  segara = await pub("Pura Segara Bersama");
  expect(segara.bankAccounts).toHaveLength(2);
  second = segara.bankAccounts!.find((b) => b.label === "Pembangunan")!.id;
  expect(segara.bankAccounts![0].isPrimary).toBe(true); // the old one stays primary
  const log = await (await (await as("admin@contoh.id")).get("/api/admin/log")).text();
  expect(log).toContain("Menambah rekening pura");
});

test("dua rekening: umat memilih rekening yang ditransfer; pengurus melihatnya; saldo per rekening; CSV per rekening", async ({ page }) => {
  await signInUi(page, "ayu@contoh.id");
  await page.goto(`/pura/${segara.slug}/punia`);
  const group = page.getByRole("radiogroup", { name: "Rekening tujuan" });
  await expect(group.getByRole("radio")).toHaveCount(2);
  await expect(group).toContainText("Panitia Pembangunan Pura Segara (contoh)"); // holder and label in each choice
  await expect(group).toContainText("Pembangunan");
  // Without a choice the server refuses.
  const none = await command(page.request, "submitPunia", { templeId: segara.id, amount: 41_000, transferDate: today(), evidence: receiptDataUrl(6102), anonymous: false, purpose: "pembangunan" });
  expect(none.ok).toBe(false);
  expect(none.error).toMatch(/Pilih rekening tujuan/);
  // Through the screen, choosing "Pembangunan".
  await group.getByRole("radio", { name: /Pembangunan/ }).click();
  await page.locator("input[inputmode=numeric]").first().fill("42000");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "bukti.png", mimeType: "image/png", buffer: receipt(6103) });
  await page.getByRole("button", { name: /Kirim punia/ }).click();
  await expect(page.getByText("Suksma! Punia terkirim")).toBeVisible();
  // A second one to the primary account, for the CSV check.
  const toPrimary = await command(page.request, "submitPunia", { templeId: segara.id, accountId: segara.bankAccounts![0].id, amount: 43_000, transferDate: today(), evidence: receiptDataUrl(6104), anonymous: false, purpose: "umum" });
  expect(toPrimary.ok, toPrimary.error).toBe(true);

  // Pengurus: the chosen account is shown; the CSV of ONE account only matches punia sent there.
  await signInUi(page, "made@contoh.id");
  await command(page.request, "setActiveTemple", { templeId: segara.id });
  await page.goto("/app/punia");
  const card = page.locator("li").filter({ hasText: "Rp42.000" });
  await expect(card).toContainText("Ke rekening: Pembangunan");
  await page.getByRole("button", { name: /Cocokkan mutasi/ }).click();
  await page.getByLabel("Mutasi dari rekening").selectOption(second);
  const csv = `Tanggal;Keterangan;Kredit\n${today()};TRF AYU;42.000,00\n${today()};TRF LAIN;43.000,00\n`;
  await page.locator('input[type="file"][accept*="csv"]').setInputFiles({ name: "mutasi.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText(/1 dari 1 punia menunggu cocok/)).toBeVisible();
  await page.getByRole("button", { name: /Sahkan 1 punia yang cocok/ }).click();
  await expect(page.getByText("1 punia disahkan.")).toBeVisible();

  // The income is booked on the account the umat chose; balances are per account, total stays.
  const st = await state(await as("made@contoh.id", segara.id));
  const d = (st.data.donations as { amount: number; transactionId?: string; accountId?: string }[]).find((x) => x.amount === 42_000)!;
  expect(d.accountId).toBe(second);
  const tx = (st.data.transactions as { id: string; accountId: string }[]).find((t) => t.id === d.transactionId)!;
  expect(tx.accountId).toBe(second);
  await page.goto("/app");
  const perAccount = page.getByRole("list", { name: "Saldo per rekening" });
  await expect(perAccount).toContainText("Pembangunan");
  await expect(perAccount).toContainText("Rp42.000");
});

test("rekening dinonaktifkan: hilang dari pilihan umat, transaksi lama & saldo tetap, tidak bisa dipakai lagi", async () => {
  const admin = await as("admin@contoh.id");
  expect((await command(admin, "adminSetBankAccountActive", { id: second, active: false })).ok).toBe(false); // reason required
  expect((await command(admin, "adminSetBankAccountActive", { id: second, active: false, reason: "Pembangunan sudah selesai" })).ok).toBe(true);
  expect((await pub("Pura Segara Bersama")).bankAccounts).toHaveLength(1);
  const made = await as("made@contoh.id", segara.id);
  const st = await state(made);
  expect((st.data.transactions as { accountId: string }[]).some((t) => t.accountId === second)).toBe(true);
  const acc = (st.data.accounts as { id: string; archived?: boolean }[]).find((a) => a.id === second)!;
  expect(acc.archived).toBe(true);
  const add = await command(made, "addTransaction", {
    input: { type: "expense", amount: 1_000, date: today(), description: "Uji rekening nonaktif", accountId: second, categoryId: st.data.categories.find((c: { type: string }) => c.type === "expense").id, status: "confirmed" },
    key: "rek-nonaktif-01",
  });
  expect(add.ok).toBe(false);
  expect(add.error).toMatch(/nonaktif/);
  const umat = await as("ayu@contoh.id");
  expect((await command(umat, "submitPunia", { templeId: segara.id, accountId: second, amount: 9_000, transferDate: today(), evidence: receiptDataUrl(6105), anonymous: false, purpose: "umum" })).ok).toBe(true); // one account left → it is used
  expect((await command(admin, "adminSetBankAccountActive", { id: second, active: true })).ok).toBe(true);
});

test("QRIS: hanya Admin Utama yang memasang; tampil dengan peringatan nama merchant; punia lewat QRIS tercatat", async ({ page }) => {
  const made = await as("made@contoh.id", segara.id);
  const primary = segara.bankAccounts![0].id;
  expect((await command(made, "adminSetQris", { templeId: segara.id, image: receiptDataUrl(6106), accountId: primary })).ok).toBe(false);
  const admin = await as("admin@contoh.id");
  const r = await command(admin, "adminSetQris", { templeId: segara.id, image: receiptDataUrl(6107), accountId: primary });
  expect(r.ok, r.error).toBe(true);
  const t = await pub("Pura Segara Bersama");
  expect(t.qrisImage).toBeTruthy();
  expect(t.qrisAccountId).toBe(primary);

  await signInUi(page, "ayu@contoh.id");
  await page.goto(`/pura/${segara.slug}/punia`);
  await page.getByRole("tab", { name: "QRIS" }).click();
  await expect(page.getByAltText(/QRIS/)).toBeVisible();
  await expect(page.getByText(/Pastikan nama merchant/)).toContainText(t.name);
  await expect(page.getByText(/hanya mencatat/)).toBeVisible();
  const q = await command<{ channel: string; accountId: string }>(page.request, "submitPunia", { templeId: segara.id, via: "qris", amount: 27_000, transferDate: today(), evidence: receiptDataUrl(6108), anonymous: false, purpose: "umum" });
  expect(q.ok, q.error).toBe(true);
  expect(q.value.channel).toBe("qris");
  expect(q.value.accountId).toBe(primary);
  const log = await (await admin.get("/api/admin/log")).text();
  expect(log).toContain("Memperbarui QRIS pura");
});
