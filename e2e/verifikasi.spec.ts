import { expect, request as pw, test } from "@playwright/test";
import { command, publicData, signInApi, signInUi } from "./helpers";

// Phase 3.4 tahap 3 — internal verification checklist per temple (Admin Utama only, logged).
test.describe.configure({ mode: "serial" });
const BASE = "http://localhost:3100";
const NOTE = "Kelian banjar ramah, rekening dicek lewat buku tabungan (catatan uji).";

test("Admin Utama mengisi checklist verifikasi dengan tanggal; tercatat di Log", async ({ page }) => {
  await signInUi(page, "admin@contoh.id");
  await page.goto("/app/admin");
  const card = page.locator("li").filter({ hasText: "CONTOH Pura Desa Sukamerta" });
  await expect(card.getByText("Verifikasi 0/4")).toBeVisible();
  await card.getByRole("button", { name: "Verifikasi" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Pemberi referensi sudah dihubungi").check();
  await dlg.locator("#vf-ref").fill("2026-10-01");
  await dlg.getByLabel("Panggilan video dengan pengurus").check();
  await dlg.locator("#vf-video").fill("2026-10-05");
  await dlg.getByLabel("Rekening resmi sudah dicek").check();
  await dlg.getByLabel("Rekening atas nama").selectOption("banjar");
  await dlg.locator("#vf-trial-start").fill("2026-10-10");
  await dlg.locator("#vf-trial-end").fill("2027-01-10");
  await dlg.getByLabel("Catatan bebas").fill(NOTE);
  await dlg.getByRole("button", { name: "Simpan catatan verifikasi" }).click();
  await expect(page.getByText("Catatan verifikasi disimpan")).toBeVisible();
  await expect(card.getByText("Verifikasi 4/4")).toBeVisible();
  await expect(card.getByText(/Percobaan s\.d\. 10 Januari 2027/)).toBeVisible();

  const admin = await pw.newContext({ baseURL: BASE });
  await signInApi(admin, "admin@contoh.id");
  const log = await (await admin.get("/api/admin/log")).text();
  expect(log).toContain("Mengubah catatan verifikasi pura");
  // Trial end before its start is refused.
  const desa = (await (await admin.get("/api/admin/users")).json()).temples.find((t: { name: string }) => t.name.endsWith("Pura Desa Sukamerta"));
  expect((await command(admin, "adminSaveVerification", { templeId: desa.id, trialStart: "2027-01-10", trialEnd: "2026-01-01" })).ok).toBe(false);
});

test("hanya Admin Utama: pengurus tidak bisa mengubah atau melihatnya; tidak ada di data publik", async () => {
  const wayan = await pw.newContext({ baseURL: BASE });
  await signInApi(wayan, "wayan@contoh.id"); // Ketua Pura Desa
  const desa = (await publicData(wayan)).temples.find((t) => t.name.endsWith("Pura Desa Sukamerta"))!;
  await command(wayan, "setActiveTemple", { templeId: desa.id });
  expect((await command(wayan, "adminSaveVerification", { templeId: desa.id, notes: "coba" })).ok).toBe(false);
  expect((await wayan.get("/api/admin/users")).status()).toBe(403);
  expect(await (await wayan.get("/api/state")).text()).not.toContain(NOTE);
  expect(await (await (await pw.newContext({ baseURL: BASE })).get("/api/public")).text()).not.toContain(NOTE);
});
