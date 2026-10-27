import { expect, request as pw, test } from "@playwright/test";
import { command, publicData, receipt, receiptDataUrl, signInApi, signInUi, templeId, today } from "./helpers";

// Uses the fictional demo data from scripts/seed-demo.ts. Tests run in order and share it.
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3100";
async function as(email: string) {
  const ctx = await pw.newContext({ baseURL: BASE });
  await signInApi(ctx, email);
  return ctx;
}

test("pengurus masuk dengan email terdaftar (huruf besar/kecil tidak berpengaruh) dan masuk ke Dashboard", async ({ page }) => {
  await signInUi(page, "Made@Contoh.ID");
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByRole("heading", { name: /Suarjana/ })).toBeVisible();
});

test("umat baru mendaftar sendiri dan tidak bisa membuka data pura", async ({ page }) => {
  await signInUi(page, "umat.baru@contoh.id");
  await expect(page).toHaveURL(/\/umat/);
  const state = await (await page.request.get("/api/state")).json();
  expect(state.state.access.isStaff).toBe(false);
  expect(state.state.data.temples).toHaveLength(0);
  expect(state.state.data.donations).toHaveLength(0);
  const dalem = await templeId(page.request, "Pura Dalem Kahyangan");
  const r = await command(page.request, "setActiveTemple", { templeId: dalem.id });
  expect(r.ok).toBe(false);
  await page.goto("/app/punia");
  await expect(page).toHaveURL(/\/umat/);
});

let anonId = "";
test("umat mengirim punia ANONIM lewat formulir", async ({ page }) => {
  await signInUi(page, "rahasia@contoh.id");
  expect((await command(page.request, "updateUser", { name: "Dewi Rahasia", callName: "Dewi" })).ok).toBe(true);
  const dalem = await templeId(page.request, "Pura Dalem Kahyangan");
  await page.goto(`/pura/${dalem.slug}/punia`);
  await page.getByRole("textbox").first().fill("123456");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "bukti.png", mimeType: "image/png", buffer: receipt(901) });
  await page.getByRole("radio", { name: /ANONIM/ }).click();
  await page.getByRole("button", { name: /Kirim punia/ }).click();
  await expect(page.getByText("Suksma! Punia terkirim")).toBeVisible();
  const mine = await (await page.request.get("/api/umat")).json();
  const d = mine.punia.find((x: { amount: number }) => x.amount === 123_456);
  expect(d.status).toBe("pending");
  expect(d.privacy).toBe("anonymous");
  anonId = d.id;
});

test("pengurus lain memverifikasi, dan nama asli TIDAK terkirim ke tampilan publik", async ({ page }) => {
  const dalem = await templeId(page.request, "Pura Dalem Kahyangan");
  const komang = await as("komang@contoh.id");
  expect((await command(komang, "setActiveTemple", { templeId: dalem.id })).ok).toBe(true);
  const v = await command<{ verified: number }>(komang, "verifyPunia", { ids: [anonId] });
  expect(v.ok, v.error).toBe(true);
  expect(v.value.verified).toBe(1);

  const raw = await (await page.request.get("/api/public")).text();
  expect(raw).not.toContain("Rahasia");
  expect(raw).not.toContain("rahasia@contoh.id");
  const pub = await publicData(page.request);
  const shown = pub.donations.filter((d) => d.templeId === dalem.id && d.amount === 123_456);
  expect(shown).toHaveLength(1);
  expect(shown[0].donorName).toBe("Anonim");

  await page.goto(`/pura/${dalem.slug}`);
  await expect(page.getByText("Anonim").first()).toBeVisible();
  await expect(page.getByText("Rahasia")).toHaveCount(0);
});

test("pengurus tidak bisa memverifikasi punia dari emailnya sendiri", async () => {
  const made = await as("made@contoh.id");
  const pub = await publicData(made);
  const dalem = pub.temples.find((t) => t.name === "Pura Dalem Kahyangan")!;
  const sent = await command<{ id: string }>(made, "submitPunia", { templeId: dalem.id, amount: 50_000, transferDate: today(), evidence: receiptDataUrl(902), anonymous: false, purpose: "umum" });
  expect(sent.ok, sent.error).toBe(true);
  await command(made, "setActiveTemple", { templeId: dalem.id });
  const self = await command(made, "verifyPunia", { ids: [sent.value.id] });
  expect(self.ok).toBe(false);
  expect(self.error).toMatch(/sendiri/);
  const komang = await as("komang@contoh.id");
  await command(komang, "setActiveTemple", { templeId: dalem.id });
  expect((await command(komang, "verifyPunia", { ids: [sent.value.id] })).ok).toBe(true);
});

test("Pengurus Banjar membuka semua pura banjarnya (termasuk pura bersama), tidak pura banjar lain", async ({ page }) => {
  const names = ["Pura Desa Sukamerta", "Pura Puseh Sukamerta", "Pura Dalem Kahyangan", "Pura Melanting Pasar", "Pura Segara Bersama"];
  const ketut = await as("ketut.banjar@contoh.id");
  for (const n of names) expect((await command(ketut, "setActiveTemple", { templeId: (await templeId(page.request, n)).id })).ok, n).toBe(true);
  expect((await command(ketut, "setActiveTemple", { templeId: (await templeId(page.request, "Pura Taman Tunjung")).id })).ok).toBe(false);

  const gede = await as("gede.banjar@contoh.id");
  expect((await command(gede, "setActiveTemple", { templeId: (await templeId(page.request, "Pura Segara Bersama")).id })).ok).toBe(true);
  expect((await command(gede, "setActiveTemple", { templeId: (await templeId(page.request, "Pura Taman Tunjung")).id })).ok).toBe(true);
  expect((await command(gede, "setActiveTemple", { templeId: (await templeId(page.request, "Pura Dalem Kahyangan")).id })).ok).toBe(false);

  await signInUi(page, "ketut.banjar@contoh.id");
  await page.goto("/app/banjar");
  await expect(page.getByText("Pura Segara Bersama")).toBeVisible();
  await expect(page.getByText("Pura Taman Tunjung")).toHaveCount(0);
});

test("punia ke pura tanpa pengurus diverifikasi oleh Pengurus Banjar", async ({ page }) => {
  const melanting = await templeId(page.request, "Pura Melanting Pasar");
  const kadek = await as("kadek@contoh.id");
  const sent = await command<{ id: string }>(kadek, "submitPunia", { templeId: melanting.id, amount: 60_000, transferDate: today(), evidence: receiptDataUrl(903), anonymous: false, purpose: "umum" });
  expect(sent.ok, sent.error).toBe(true);
  const ketut = await as("ketut.banjar@contoh.id");
  await command(ketut, "setActiveTemple", { templeId: melanting.id });
  const v = await command<{ verified: number }>(ketut, "verifyPunia", { ids: [sent.value.id] });
  expect(v.ok, v.error).toBe(true);
  expect(v.value.verified).toBe(1);
});

test("bukti transfer yang sama ditolak (anti dobel)", async ({ page }) => {
  const segara = await templeId(page.request, "Pura Segara Bersama");
  const nyoman = await as("nyoman@contoh.id");
  const p = { templeId: segara.id, amount: 80_000, transferDate: today(), evidence: receiptDataUrl(904), anonymous: false, purpose: "umum" };
  expect((await command(nyoman, "submitPunia", p)).ok).toBe(true);
  const again = await command(nyoman, "submitPunia", { ...p, amount: 90_000 });
  expect(again.ok).toBe(false);
  expect(again.error).toMatch(/sudah pernah diunggah/);
});

test("rekening pura hanya bisa diubah Admin Utama", async ({ page }) => {
  const dalem = await templeId(page.request, "Pura Dalem Kahyangan");
  const made = await as("made@contoh.id");
  const r = await command(made, "setTempleBank", { templeId: dalem.id, bankName: "Bank Palsu", bankAccountNumber: "999", bankAccountHolder: "Penipu" });
  expect(r.ok).toBe(false);
});

test("umat menghapus akun: punia tetap ada sebagai arsip, nama dianonimkan di mana-mana", async ({ page }) => {
  const before = await (await page.request.get("/api/public")).text();
  expect(before).toContain("Ni Luh Ayu Lestari"); // punia TAMPIL dari data contoh
  const ayu = await as("ayu@contoh.id");
  const del = await command(ayu, "deleteMyAccount", { confirm: "HAPUS" });
  expect(del.ok, del.error).toBe(true);
  const after = await (await page.request.get("/api/public")).text();
  expect(after).not.toContain("Ayu");
  const pub = await publicData(page.request);
  const dalem = pub.temples.find((t) => t.name === "Pura Dalem Kahyangan")!;
  expect(pub.donations.some((d) => d.templeId === dalem.id && d.amount === 250_000)).toBe(true);

  const made = await as("made@contoh.id");
  const staffDelete = await command(made, "deleteMyAccount", { confirm: "HAPUS" });
  expect(staffDelete.ok).toBe(false);
});

test("keluar dari semua perangkat mengakhiri sesi lain", async () => {
  const a = await as("nyoman@contoh.id");
  const b = await as("nyoman@contoh.id");
  expect((await command(b, "logoutEverywhere")).ok).toBe(true);
  const s = await (await a.get("/api/state")).json();
  expect(s.state).toBeNull();
});

test("impor mutasi CSV menandai punia yang cocok lalu menyetujuinya", async ({ page }) => {
  // Data contoh: Kadek Surya mengirim Rp100.000 ke Pura Dalem Kahyangan 2 hari lalu (masih menunggu).
  const d = new Date(Date.now() + 8 * 3600_000 - 2 * 86400_000);
  const tgl = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  const csv = `Tanggal;Keterangan;Debet;Kredit\n${tgl};TRF DARI KADEK SURYA;;100.000,00\n${tgl};BIAYA ADM;5.000,00;\n`;
  await signInUi(page, "komang@contoh.id");
  await page.goto("/app/punia");
  await page.getByRole("button", { name: /Cocokkan mutasi/ }).click();
  await page.locator('input[type="file"][accept*="csv"]').setInputFiles({ name: "mutasi.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("Cocok", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Sahkan 1 punia yang cocok/ }).click();
  await expect(page.getByText(/1 punia disahkan/)).toBeVisible();
});
