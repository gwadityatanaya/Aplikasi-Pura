import { expect, request as pw, test } from "@playwright/test";
import postgres from "postgres";
import { command, signInApi, signInUi, today } from "./helpers";

// Phase 3.3 tahap 5 — moving from the old books: start date + witnessed opening balances (locked,
// corrections only), no transaction before the start date, monthly check with differences.
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3100";
const NAME = "CONTOH Pura Uji Mulai Buku";
async function as(email: string, temple?: string) {
  const ctx = await pw.newContext({ baseURL: BASE });
  await signInApi(ctx, email);
  if (temple) expect((await command(ctx, "setActiveTemple", { templeId: temple })).ok).toBe(true);
  return ctx;
}
type Acc = { id: string; type: string; name: string; openingBalance: number; openingBase?: number; openingSetAt?: string };
const state = async (ctx: Awaited<ReturnType<typeof as>>) => (await (await ctx.get("/api/state")).json()).state;
const sql = () => postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
const daysAgo = (n: number) => new Date(Date.now() + 8 * 3600_000 - n * 86400_000).toISOString().slice(0, 10);
let temple = "";
let cash: Acc;
let bank: Acc;

test("mulai pembukuan: tanggal mulai + saldo awal tiap kas/rekening dengan dua saksi, lalu terkunci", async ({ page }) => {
  const admin = await as("admin@contoh.id");
  const users = await (await admin.get("/api/admin/users")).json();
  const banjar = users.banjars.find((b: { name: string }) => b.name === "CONTOH Banjar Adat Kertha Sari");
  const t = await command<{ id: string }>(admin, "adminSaveTemple", { name: NAME, banjarIds: [banjar.id], activationReason: "Pura uji otomatis (tes e2e)" });
  temple = t.value.id;
  for (const email of ["made@contoh.id", "komang@contoh.id"]) expect((await command(admin, "adminAddStaff", { email, kind: "pengurus", templeId: temple })).ok).toBe(true);
  const made = await as("made@contoh.id", temple);
  const accs = (await state(made)).data.accounts as Acc[];
  cash = accs.find((a) => a.type === "cash")!;
  bank = accs.find((a) => a.type === "bank")!;
  const base = { startDate: daysAgo(20), balances: [{ accountId: cash.id, amount: 1_000_000 }, { accountId: bank.id, amount: 2_500_000 }] };
  expect((await command(made, "startBooks", { ...base, witnesses: ["I Made Suarjana (contoh)"] })).ok).toBe(false);
  expect((await command(made, "startBooks", { ...base, witnesses: ["I Made", "i made"] })).error).toMatch(/berbeda/);
  expect((await command(made, "startBooks", { ...base, balances: base.balances.slice(0, 1), witnesses: ["A Satu", "B Dua"] })).error).toMatch(/semua kas dan rekening/);
  expect((await command(made, "startBooks", { ...base, startDate: "2999-01-01", witnesses: ["A Satu", "B Dua"] })).ok).toBe(false);
  expect((await command(await as("oka.pemeriksa@contoh.id"), "startBooks", { ...base, witnesses: ["A Satu", "B Dua"] })).ok).toBe(false);

  // Through the screen.
  await signInUi(page, "made@contoh.id");
  await command(page.request, "setActiveTemple", { templeId: temple });
  await page.goto("/app/pengaturan?tab=rekening");
  await page.getByRole("button", { name: "Mulai pembukuan" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Tanggal mulai memakai aplikasi").fill(base.startDate);
  const money = dlg.locator("input[inputmode=numeric]");
  await money.nth(0).fill("1000000");
  await money.nth(1).fill("2500000");
  await dlg.locator("#saksi-1").fill("I Made Suarjana (contoh)");
  await dlg.locator("#saksi-2").fill("I Komang Adi (contoh)");
  await expect(dlg.getByRole("button", { name: "Simpan & kunci saldo awal" })).toBeDisabled();
  await dlg.getByLabel(/Kami berdua sudah menghitung/).check();
  await dlg.getByRole("button", { name: "Simpan & kunci saldo awal" }).click();
  await expect(page.getByText("Pembukuan dimulai. Saldo awal tersimpan dan terkunci.")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Pembukuan di aplikasi dimulai" })).toContainText("I Made Suarjana (contoh) & I Komang Adi (contoh)");

  const st = await state(made);
  expect(st.data.temples.find((x: { id: string }) => x.id === temple).booksStartDate).toBe(base.startDate);
  const c = (st.data.accounts as Acc[]).find((a) => a.id === cash.id)!;
  expect(c.openingBalance).toBe(1_000_000);
  expect(c.openingSetAt).toBeTruthy();
  // Locked: a second start, an edit of the opening balance, and the database itself refuse.
  expect((await command(made, "startBooks", { ...base, witnesses: ["A Satu", "B Dua"] })).error).toMatch(/sudah dimulai/);
  expect((await command(made, "saveAccount", { id: cash.id, name: cash.name, type: "cash", openingBalance: 5, openingDate: base.startDate })).error).toMatch(/dikunci/);
  const db = sql();
  await expect(db`update accounts set opening_balance = 1 where id = ${cash.id}`).rejects.toThrow(/tidak boleh diubah/);
  await expect(db`update temples set books_start_date = ${daysAgo(30)} where id = ${temple}`).rejects.toThrow(/tidak boleh diubah/);
  await db.end();
});

test("transaksi sebelum tanggal mulai ditolak (aplikasi & database); sesudahnya boleh", async ({ page }) => {
  const made = await as("made@contoh.id", temple);
  const st = await state(made);
  const cat = st.data.categories.find((c: { type: string }) => c.type === "expense").id;
  const input = (date: string, key: string) => ({ input: { type: "expense", amount: 200_000, date, description: "Beli canang", accountId: cash.id, categoryId: cat, status: "confirmed" }, key });
  const before = await command(made, "addTransaction", input(daysAgo(25), "mulai-sebelum-01"));
  expect(before.ok).toBe(false);
  expect(before.error).toMatch(/sebelum tanggal mulai pembukuan/);
  expect((await command(made, "addTransaction", input(daysAgo(10), "mulai-sesudah-01"))).ok).toBe(true);
  const db = sql();
  await expect(db`insert into transactions (id, number, temple_id, type, amount, date, description, account_id, status, created_by, created_at, updated_at)
                  values ('tx_uji_lama', 'X-1', ${temple}, 'expense', 1, ${daysAgo(30)}, 'uji', ${cash.id}, 'draft', 'x', now(), now())`).rejects.toThrow(/sebelum tanggal mulai/);
  await db.end();
  // The form warns before sending.
  await signInUi(page, "made@contoh.id");
  await command(page.request, "setActiveTemple", { templeId: temple });
  await page.goto("/app/transaksi/baru?type=expense");
  await expect(page.locator("#date")).toHaveAttribute("min", daysAgo(20));
});

test("koreksi saldo awal: tercatat terpisah dengan alasan & dua saksi, tidak bisa dihapus", async () => {
  const made = await as("made@contoh.id", temple);
  expect((await command(made, "correctOpeningBalance", { accountId: cash.id, amount: 50_000, reason: "", witnesses: ["A Satu", "B Dua"] })).ok).toBe(false);
  const r = await command(made, "correctOpeningBalance", { accountId: cash.id, amount: 50_000, reason: "Uang di amplop terpisah belum terhitung", witnesses: ["I Made Suarjana (contoh)", "I Komang Adi (contoh)"] });
  expect(r.ok, r.error).toBe(true);
  const st = await state(made);
  const c = (st.data.accounts as Acc[]).find((a) => a.id === cash.id)!;
  expect(c.openingBase).toBe(1_000_000);
  expect(c.openingBalance).toBe(1_050_000);
  expect(st.data.openingCorrections).toHaveLength(1);
  expect(JSON.stringify(st.data.audit)).toContain("Mengoreksi saldo awal");
  const db = sql();
  await expect(db`delete from opening_corrections where temple_id = ${temple}`).rejects.toThrow(/tidak boleh diubah atau dihapus/);
  await expect(db`update accounts set opening_adjust = 0 where id = ${cash.id}`).rejects.toThrow(/hanya lewat catatan koreksi/);
  await db.end();
});

test("pencocokan bulanan: selisih ditandai jelas, tidak mengubah saldo, ikut tercetak di laporan", async ({ page }) => {
  const made = await as("made@contoh.id", temple);
  const month = today().slice(0, 7);
  expect((await command(made, "saveReconciliation", { month: "2020-01", items: [{ accountId: cash.id, statementBalance: 1 }] })).ok).toBe(false); // before the start
  // App: cash 1.050.000 − 200.000 = 850.000; counted 800.000. Bank 2.500.000, statement the same.
  await signInUi(page, "made@contoh.id");
  await command(page.request, "setActiveTemple", { templeId: temple });
  await page.goto("/app/laporan");
  await page.locator("#rk-month").fill(month);
  const items = page.getByRole("list", { name: "Isian pencocokan" }).getByRole("listitem");
  const cashItem = items.filter({ hasText: "Kas Tunai Pura" });
  const bankItem = items.filter({ hasText: "Rekening Pura" });
  await expect(cashItem).toContainText("Rp850.000");
  await cashItem.locator("input[inputmode=numeric]").fill("800000");
  await bankItem.locator("input[inputmode=numeric]").fill("2500000");
  await expect(cashItem).toContainText("Selisih −Rp50.000");
  await expect(bankItem).toContainText("Cocok");
  await page.getByRole("button", { name: "Simpan pencocokan" }).click();
  await expect(page.getByText(/Pencocokan .* dicatat/)).toBeVisible();
  const history = page.getByRole("list", { name: "Hasil pencocokan" });
  await expect(history).toContainText("Selisih −Rp50.000");
  await expect(history).toContainText("Cocok");

  const st = await state(made);
  const rec = (st.data.reconciliations as { accountId: string; appBalance: number; statementBalance: number }[]).find((r) => r.accountId === cash.id)!;
  expect(rec).toMatchObject({ appBalance: 850_000, statementBalance: 800_000 });
  expect((st.data.accounts as Acc[]).find((a) => a.id === cash.id)!.openingBalance).toBe(1_050_000); // unchanged
  // Printed with the report (above the signatures).
  const [d] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "CSV" }).click()]);
  const csv = Buffer.concat(await (await d.createReadStream()).toArray()).toString("utf8");
  expect(csv).toContain("Pencocokan saldo bulanan");
  expect(csv).toContain("-50000");
});
