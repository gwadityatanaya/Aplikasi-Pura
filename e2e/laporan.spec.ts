import { expect, request as pw, type Download, type Page, test } from "@playwright/test";
import { createRequire } from "module";
import { command, publicData, signInApi, signInUi } from "./helpers";

// Phase 3.2 — detailed reports (one row per transaction, running balance), jabatan per
// kepengurusan set by Admin Utama, choosing signers, signature block, A4 / F4.
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3100";
const text = async (d: Download) => Buffer.concat(await (await d.createReadStream()).toArray()).toString("latin1");

async function openReports(page: Page, email: string) {
  await signInUi(page, email);
  const dalem = (await publicData(page.request)).temples.find((t) => t.name.endsWith("Pura Dalem Kahyangan"))!;
  await command(page.request, "setActiveTemple", { templeId: dalem.id });
  await page.goto("/app/laporan");
  await expect(page.getByRole("heading", { name: "Laporan Keuangan", exact: true }).first()).toBeVisible();
}

async function csv(page: Page) {
  const [d] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "CSV" }).click()]);
  return { name: d.suggestedFilename(), body: Buffer.concat(await (await d.createReadStream()).toArray()).toString("utf8") };
}

/** Splits our CSV (quoted fields) into rows of cells. */
function rows(body: string) {
  return body.replace(/^﻿/, "").split("\n").map((l) => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? []).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')));
}
const num = (s: string | undefined) => (s ? Number(s) : 0);

test("laporan rinci: satu baris per transaksi, saldo berjalan benar, versi umum vs lengkap", async ({ page }) => {
  await openReports(page, "made@contoh.id");
  const umum = await csv(page);
  const r = rows(umum.body);
  const h = r.findIndex((x) => x[0] === "Tanggal" && x[6] === "Saldo");
  expect(h, "kolom: Tanggal, No. bukti, Uraian, Kategori, Pemasukan, Pengeluaran, Saldo").toBeGreaterThan(0);
  expect(r[h].slice(0, 7)).toEqual(["Tanggal", "No. bukti", "Uraian", "Kategori", "Pemasukan", "Pengeluaran", "Saldo"]);
  expect(r[h]).not.toContain("Dicatat oleh");
  expect(r[h + 1][2]).toBe("Saldo awal periode");
  let saldo = num(r[h + 1][6]);
  let i = h + 2;
  let entries = 0;
  for (; r[i] && r[i][0] && r[i][2] !== "Jumlah / saldo akhir"; i++) {
    saldo += num(r[i][4]) - num(r[i][5]);
    expect(num(r[i][6]), `saldo berjalan baris ${r[i][1]}`).toBe(saldo);
    entries++;
  }
  expect(entries).toBeGreaterThanOrEqual(4);
  expect(r[i][2]).toBe("Jumlah / saldo akhir");
  expect(num(r[i][6])).toBe(saldo);
  // Summary per category still follows at the end.
  expect(umum.body).toContain("Ringkasan pemasukan per kategori");
  expect(umum.body).toContain("Ringkasan pengeluaran per kategori");
  // Anonymous donor (demo: I Nyoman Darma, Rp500.000 anonim) stays "Anonim" in the shareable version.
  expect(umum.body).toContain("Punia: Anonim");
  expect(umum.body).not.toContain("Nyoman Darma");

  await page.locator("#r-version").selectOption("lengkap");
  const full = await csv(page);
  expect(full.body).toContain("Dicatat oleh");
  expect(full.body).toContain("I Nyoman Darma (contoh) (anonim)");
  expect(full.name).toContain("internal");
});

test("penanda tangan: nama dari jabatan, peringatan jika kosong, garis kosong, Mengetahui, kertas F4", async ({ page }) => {
  await openReports(page, "made@contoh.id");
  // Demo: Dalem has a Ketua (Made) and a Bendahara (Komang) but no Sekretaris yet.
  await expect(page.getByRole("alert").filter({ hasText: "Jabatan Sekretaris belum diisi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PDF" })).toBeDisabled();

  await page.locator("#r-sign").selectOption("ketua_bendahara");
  await expect(page.getByRole("alert").filter({ hasText: "belum diisi" })).toHaveCount(0);
  await page.locator("#r-ack").selectOption({ label: "Kelian Banjar CONTOH Banjar Adat Kertha Sari — I Ketut Wirawan (contoh)" });
  await page.locator("#r-paper").selectOption("f4");
  const [d] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PDF" }).click()]);
  const pdf = await text(d);
  for (const s of ["Rincian transaksi", "Saldo awal periode", "Ketua", "I Made Suarjana", "Bendahara", "I Komang Adi", "Mengetahui,", "I Ketut Wirawan", "Hal. 1 dari"]) expect(pdf, s).toContain(s);
  expect(pdf).not.toContain("Sekretaris");
  expect(pdf).toMatch(/\/MediaBox \[0 0 935\.4\d* 609\.4\d*\]/); // F4, landscape for the wide cash book

  // All three, with Sekretaris printed as a dotted line to sign by hand.
  await page.locator("#r-sign").selectOption("semua");
  await page.getByLabel("Cetak dengan garis kosong (titik-titik)").check();
  await page.locator("#r-paper").selectOption("a4");
  const [d2] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PDF" }).click()]);
  const pdf2 = await text(d2);
  expect(pdf2).toContain("Sekretaris");
  expect(pdf2).toContain("........");
  expect(pdf2).toMatch(/\/MediaBox \[0 0 841\.8\d* 595\.2\d*\]/);
});

test("Pemeriksa: hanya versi umum, tanpa pilihan tanda tangan", async ({ page }) => {
  await signInUi(page, "oka.pemeriksa@contoh.id");
  await page.goto("/app/laporan");
  await expect(page.getByRole("heading", { name: "Laporan Keuangan", exact: true }).first()).toBeVisible();
  await expect(page.locator("#r-version")).toHaveCount(0);
  await expect(page.locator("#r-sign")).toHaveCount(0);
});

test("jabatan per kepengurusan: hanya Admin Utama, satu Ketua per pura, tercatat di Log", async ({ page }) => {
  await signInUi(page, "admin@contoh.id");
  await page.goto("/app/admin");
  await page.locator("li").filter({ hasText: "CONTOH Pura Dalem Kahyangan" }).getByRole("button", { name: /^Pengurus$/ }).click();
  const row = page.getByRole("dialog").locator("li").filter({ hasText: "oka.pemeriksa@contoh.id" });
  await row.getByLabel("Jabatan").selectOption("sekretaris");
  await expect(page.getByText("Jabatan disimpan")).toBeVisible();

  const users = await (await page.request.get("/api/admin/users")).json();
  const oka = users.users.find((u: { email: string }) => u.email === "oka.pemeriksa@contoh.id");
  const komang = users.users.find((u: { email: string }) => u.email === "komang@contoh.id");
  const dalemId = users.temples.find((t: { name: string }) => t.name.endsWith("Pura Dalem Kahyangan")).id;
  const mem = (uid: string) => users.memberships.find((m: { userId: string; templeId: string }) => m.userId === uid && m.templeId === dalemId);
  expect(mem(oka.id).position).toBe("sekretaris");

  // A second Ketua in the same temple is refused (Made is Ketua).
  const dup = await command(page.request, "adminSetPosition", { kind: "temple", id: mem(komang.id).id, position: "ketua" });
  expect(dup.ok).toBe(false);
  expect(dup.error).toMatch(/sudah dipegang/);
  // The same person can hold a different jabatan in another temple (jabatan is per kepengurusan).
  const segaraId = users.temples.find((t: { name: string }) => t.name.endsWith("Pura Segara Bersama")).id;
  const made = users.users.find((u: { email: string }) => u.email === "made@contoh.id");
  const madeSegara = users.memberships.find((m: { userId: string; templeId: string }) => m.userId === made.id && m.templeId === segaraId);
  expect((await command(page.request, "adminSetPosition", { kind: "temple", id: madeSegara.id, position: "bendahara" })).ok).toBe(true);

  const log = await (await page.request.get("/api/admin/log")).text();
  expect(log).toContain("Mengubah jabatan");

  // A pengurus cannot change jabatan.
  const pengurus = await pw.newContext({ baseURL: BASE });
  await signInApi(pengurus, "made@contoh.id");
  const denied = await command(pengurus, "adminSetPosition", { kind: "temple", id: mem(komang.id).id, position: "sekretaris" });
  expect(denied.ok).toBe(false);
});

test("Excel rapi: beberapa sheet, tanggal & Rupiah sebagai angka, rumus SUM & saldo, tanda tangan, kertas F4", async ({ page }) => {
  // The prebuilt bundle: the Node entry of exceljs pulls in a dependency that the test runner's
  // module loader cannot transform.
  const ExcelJS = createRequire(__filename)("exceljs/dist/exceljs.min.js") as typeof import("exceljs");
  await openReports(page, "made@contoh.id");
  await page.locator("#r-sign").selectOption("ketua_bendahara");
  await page.locator("#r-paper").selectOption("f4");
  const [d] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Excel" }).click()]);
  expect(d.suggestedFilename()).toMatch(/\.xlsx$/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.concat(await (await d.createReadStream()).toArray()) as unknown as ArrayBuffer);
  const names = wb.worksheets.map((w) => w.name);
  expect(names.slice(0, 3)).toEqual(["Ringkasan", "Rincian Transaksi", "Per Kategori"]);
  for (const n of names) expect(n.length).toBeLessThanOrEqual(31);

  const ws = wb.getWorksheet("Rincian Transaksi")!;
  let head = 0;
  ws.eachRow((row, i) => { if (!head && row.getCell(1).value === "Tanggal" && row.getCell(7).value === "Saldo") head = i; });
  expect(head, "baris judul kolom buku kas").toBeGreaterThan(0);
  // Header frozen and repeated on every printed page; F4 landscape, fit to width.
  expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: head });
  expect(ws.pageSetup).toMatchObject({ paperSize: 14, orientation: "landscape", fitToPage: true, fitToWidth: 1, printTitlesRow: `${head}:${head}` });
  expect(String(ws.headerFooter.oddFooter)).toContain("Hal. &P dari &N");

  const first = ws.getRow(head + 2); // first transaction (row after "Saldo awal periode")
  expect(first.getCell(1).value).toBeInstanceOf(Date);
  expect(first.getCell(1).numFmt).toContain("d mmm yyyy");
  const income = first.getCell(5).value ?? first.getCell(6).value;
  expect(typeof income).toBe("number");
  expect(first.getCell(5).numFmt ?? first.getCell(6).numFmt).toContain('"Rp"');
  expect(first.getCell(5).alignment?.horizontal).toBe("right");
  const bal = first.getCell(7).value as { formula: string; result: number };
  expect(bal.formula).toBe(`G${head + 1}+N(E${head + 2})-N(F${head + 2})`);

  let foot = 0;
  ws.eachRow((row, i) => { if (row.getCell(3).value === "Jumlah / saldo akhir") foot = i; });
  expect((ws.getCell(foot, 5).value as { formula: string }).formula).toBe(`SUM(E${head + 1}:E${foot - 1})`);
  expect((ws.getCell(foot, 7).value as { formula: string }).formula).toBe(`G${foot - 1}`);

  const texts: string[] = [];
  ws.eachRow((row) => row.eachCell((c) => typeof c.value === "string" && texts.push(c.value)));
  for (const s of ["Ketua", "I Made Suarjana (contoh)", "Bendahara", "I Komang Adi (contoh)"]) expect(texts, s).toContain(s);
  expect(texts).not.toContain("Sekretaris");
  // Shareable version: anonymous donor stays anonymous in the workbook too.
  wb.eachSheet((s) => s.eachRow((row) => row.eachCell((c) => expect(String(c.value ?? "")).not.toContain("Nyoman Darma"))));
});
