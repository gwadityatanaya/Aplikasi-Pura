import { expect, request as pw, test } from "@playwright/test";
import { command, publicData, receiptDataUrl, signInApi, signInUi, today } from "./helpers";

// Phase 3.4 tahap 5b — digital punia proof (page + PDF) for the umat who sent it: pura, nominal,
// date, status, record number and "konfirmasi pencatatan, bukan kuitansi bank". No pengurus name,
// no full account number, and an anonymous donor's name only for the account owner.
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3100";
async function as(email: string, temple?: string) {
  const ctx = await pw.newContext({ baseURL: BASE });
  await signInApi(ctx, email);
  if (temple) expect((await command(ctx, "setActiveTemple", { templeId: temple })).ok).toBe(true);
  return ctx;
}
type Acc = { id: string; type: string; archived?: boolean; accountNumber?: string; isPrimary?: boolean };
type U = { id: string; name: string; email: string };
const DONOR = "Ni Luh Ayu Lestari (contoh)"; // ayu's account name in the demo data
let dalem = { id: "", name: "" };
let puniaId = "";
let number = "";
let fullAccountNo = "";
let pengurusNames: string[] = [];

test("API bukti: hanya pemilik akun; tanpa nama pengurus dan nomor rekening lengkap", async () => {
  const t = (await publicData(await pw.newContext({ baseURL: BASE }))).temples.find((x) => x.name.endsWith("Pura Dalem Kahyangan"))!;
  dalem = { id: t.id, name: t.name };
  const ayu = await as("ayu@contoh.id");
  const sent = await command<{ id: string }>(ayu, "submitPunia", { templeId: dalem.id, amount: 77_123, transferDate: today(), evidence: receiptDataUrl(9555), anonymous: true, purpose: "umum" });
  expect(sent.ok, sent.error).toBe(true);
  puniaId = sent.value.id;

  // Before verification: status "menunggu", no record number yet.
  const before = await (await ayu.get(`/api/umat/punia/${puniaId}`)).json();
  expect(before.ok).toBe(true);
  expect(before.proof.status).toBe("pending");
  expect(before.proof.number).toBeUndefined();

  const made = await as("made@contoh.id", dalem.id);
  const st = (await (await made.get("/api/state")).json()).state;
  const bank = (st.data.accounts as Acc[]).find((a) => a.type === "bank" && !a.archived && a.isPrimary) ?? (st.data.accounts as Acc[]).find((a) => a.type === "bank" && !a.archived)!;
  fullAccountNo = bank.accountNumber!.replace(/\D/g, "");
  pengurusNames = (st.data.users as U[]).filter((u) => ["made@contoh.id", "komang@contoh.id"].includes(u.email)).map((u) => u.name);
  expect(pengurusNames.length).toBeGreaterThan(0);
  expect((await command(made, "verifyPunia", { ids: [puniaId] })).ok).toBe(true);

  const res = await ayu.get(`/api/umat/punia/${puniaId}`);
  const body = await res.text();
  const { proof } = JSON.parse(body);
  expect(proof.status).toBe("verified");
  expect(proof.number).toMatch(/\S/);
  number = proof.number;
  expect(proof.templeName).toBe(dalem.name);
  expect(proof.amount).toBe(77_123);
  expect(proof.anonymous).toBe(true);
  expect(proof.donorName).toBe(DONOR); // the owner sees their own name
  expect(proof.into).toContain(fullAccountNo.slice(-4));
  expect(body).not.toContain(fullAccountNo);
  for (const n of pengurusNames) expect(body).not.toContain(n);
  for (const k of ["verifiedBy", "inputBy", "evidence", "submitterEmail", "correctedBy"]) expect(body).not.toContain(`"${k}"`);

  // Anyone else: another umat, the pengurus who verified it, Admin Utama → not found.
  for (const email of ["kadek@contoh.id", "made@contoh.id", "admin@contoh.id"]) {
    const other = await as(email);
    const r = await other.get(`/api/umat/punia/${puniaId}`);
    expect(r.status(), email).toBe(404);
    expect(await r.text()).not.toContain(DONOR);
  }
  // Not signed in.
  expect((await (await pw.newContext({ baseURL: BASE })).get(`/api/umat/punia/${puniaId}`)).status()).toBe(401);
});

test("halaman bukti + PDF: bukan kuitansi bank; nama anonim hanya jika pemilik memilihnya", async ({ page }) => {
  await signInUi(page, "ayu@contoh.id");
  await page.goto("/umat/punia");
  const item = page.locator("li", { hasText: "Rp77.123" });
  await item.getByRole("link", { name: "Bukti pencatatan" }).click();
  await expect(page).toHaveURL(new RegExp(`/umat/punia/${puniaId}$`));
  await expect(page.getByRole("heading", { name: "Bukti pencatatan punia" })).toBeVisible();
  await expect(page.getByTestId("bukan-kuitansi")).toContainText("BUKAN kuitansi bank");
  await expect(page.getByText(number, { exact: true })).toBeVisible();
  await expect(page.getByText(dalem.name).first()).toBeVisible();
  await expect(page.getByText("Disahkan", { exact: true })).toBeVisible();
  // Anonymous: the name is hidden until the owner ticks the box.
  await expect(page.getByText(DONOR)).toHaveCount(0);
  await expect(page.getByText("Anonim", { exact: true })).toBeVisible();

  const pdfText = async () => {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Unduh PDF" }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^bukti-punia-.*\.pdf$/);
    return Buffer.concat(await (await dl.createReadStream()).toArray()).toString("latin1");
  };
  const pdf = await pdfText();
  expect(pdf).toContain("%PDF");
  for (const s of ["Bukti pencatatan punia", "BUKAN kuitansi bank", number, "Rp77.123", "Disahkan", "Anonim"]) expect(pdf, s).toContain(s);
  expect(pdf).not.toContain("Lestari");
  expect(pdf).not.toContain(fullAccountNo);
  for (const n of pengurusNames) expect(pdf).not.toContain(n);

  await page.getByLabel(/Tampilkan nama saya/).check();
  await expect(page.getByText(`${DONOR} (anonim di laporan pura)`)).toBeVisible();
  expect(await pdfText()).toContain("Lestari");

  // Fits a phone without sideways scrolling, also with the largest text size.
  for (const size of ["normal", "sangat_besar"]) {
    expect((await command(page.request, "updateUser", { textSize: size })).ok).toBe(true);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Bukti pencatatan punia" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), size).toBeLessThanOrEqual(320);
  }
  expect((await command(page.request, "updateUser", { textSize: "normal" })).ok).toBe(true);

  // Another account opening the same address sees only "not found".
  await page.context().clearCookies();
  await signInUi(page, "kadek@contoh.id");
  await page.goto(`/umat/punia/${puniaId}`);
  await expect(page.getByText("Bukti punia tidak ditemukan.")).toBeVisible();
  await expect(page.getByText(DONOR)).toHaveCount(0);
});
