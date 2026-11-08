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

// Decision Phase 3.4: activating a pura before the checklist is 4/4 is allowed, with a warning and
// a required reason that is written to the Log.
test("mengaktifkan pura sebelum checklist 4/4: peringatan, alasan wajib, tercatat di Log", async ({ page }) => {
  const admin = await pw.newContext({ baseURL: BASE });
  await signInApi(admin, "admin@contoh.id");
  const users = async () => (await (await admin.get("/api/admin/users")).json()) as { temples: { id: string; name: string; status: string }[]; banjars: { id: string; name: string }[] };
  const banjarId = (await users()).banjars.find((b) => b.name === "CONTOH Banjar Adat Kertha Sari")!.id;
  const make = async (name: string) => {
    const r = await command<{ id: string }>(admin, "adminSaveTemple", { name, banjarIds: [banjarId], status: "pending" });
    expect(r.ok, r.error).toBe(true);
    return r.value.id;
  };
  const activate = (id: string, name: string, activationReason?: string) => command(admin, "adminSaveTemple", { id, name, banjarIds: [banjarId], status: "active", activationReason });

  // API: without a reason → refused (checklist 0/4); with a reason → active + Log entry.
  const early = await make("CONTOH Pura Uji Aktivasi Awal");
  const refused = await activate(early, "CONTOH Pura Uji Aktivasi Awal");
  expect(refused.ok).toBe(false);
  expect(refused.error).toContain("Checklist verifikasi baru 0/4");
  expect((await users()).temples.find((t) => t.id === early)!.status).toBe("pending");
  const ok = await activate(early, "CONTOH Pura Uji Aktivasi Awal", "Dipakai untuk odalan minggu depan, verifikasi menyusul");
  expect(ok.ok, ok.error).toBe(true);
  expect((await users()).temples.find((t) => t.id === early)!.status).toBe("active");
  const log = await (await admin.get("/api/admin/log")).text();
  expect(log).toContain("Mengaktifkan pura sebelum verifikasi lengkap");
  expect(log).toContain("(0/4). Alasan: Dipakai untuk odalan minggu depan");

  // Checklist 4/4 → no reason needed.
  const full = await make("CONTOH Pura Uji Aktivasi Lengkap");
  expect((await command(admin, "adminSaveVerification", { templeId: full, referenceContactedAt: "2026-10-01", videoCallAt: "2026-10-02", accountCheckedAt: "2026-10-03", accountHolderType: "banjar", trialStart: "2026-10-04" })).ok).toBe(true);
  expect((await activate(full, "CONTOH Pura Uji Aktivasi Lengkap")).ok).toBe(true);

  // Screen: the warning and the reason field appear only when activating early.
  const ui = await make("CONTOH Pura Uji Aktivasi Layar");
  await signInUi(page, "admin@contoh.id");
  await page.goto("/app/admin");
  await page.locator("li").filter({ hasText: "CONTOH Pura Uji Aktivasi Layar" }).getByRole("button", { name: "Ubah data" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByText(/Checklist verifikasi pura ini baru/)).toHaveCount(0);
  await dlg.getByLabel("Status").selectOption("active");
  await expect(dlg.getByText("Checklist verifikasi pura ini baru 0/4")).toBeVisible();
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(/Tulis alasan \(minimal 5 huruf\)/)).toBeVisible(); // refused, dialog stays open
  await dlg.getByLabel("Alasan mengaktifkan sekarang (wajib)").fill("Uji layar: rekening sudah dicek langsung");
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Data pura disimpan")).toBeVisible();
  expect((await users()).temples.find((t) => t.id === ui)!.status).toBe("active");
});

// Same rule when Admin Utama creates a pura straight away as "Aktif" through "Tambah pura".
test("Tambah pura langsung Aktif: peringatan, alasan wajib (dijaga server), tercatat; Nonaktif tanpa alasan", async ({ page }) => {
  const admin = await pw.newContext({ baseURL: BASE });
  await signInApi(admin, "admin@contoh.id");
  const users = async () => (await (await admin.get("/api/admin/users")).json()) as { temples: { id: string; name: string; status: string }[]; banjars: { id: string; name: string }[] };
  const banjarId = (await users()).banjars.find((b) => b.name === "CONTOH Banjar Adat Kertha Sari")!.id;

  // API: active without a reason → refused and NOT created (the insert is rolled back).
  const refused = await command(admin, "adminSaveTemple", { name: "CONTOH Pura Baru Tanpa Alasan", banjarIds: [banjarId], status: "active" });
  expect(refused.ok).toBe(false);
  expect(refused.error).toContain("Checklist verifikasi baru 0/4");
  expect((await users()).temples.some((t) => t.name === "CONTOH Pura Baru Tanpa Alasan")).toBe(false);
  // The status left out means "Aktif" too, so the same rule applies.
  expect((await command(admin, "adminSaveTemple", { name: "CONTOH Pura Baru Tanpa Status", banjarIds: [banjarId] })).ok).toBe(false);
  // A reason that is too short is refused as well; an "internalScript" flag sent by a client changes nothing.
  expect((await command(admin, "adminSaveTemple", { name: "CONTOH Pura Baru Alasan Pendek", banjarIds: [banjarId], status: "active", activationReason: "ok" })).ok).toBe(false);
  expect((await command(admin, "adminSaveTemple", { name: "CONTOH Pura Baru Coba Lewati", banjarIds: [banjarId], status: "active", internalScript: true })).ok).toBe(false);

  // With a reason → created active, both entries in the Log.
  const ok = await command<{ id: string }>(admin, "adminSaveTemple", { name: "CONTOH Pura Baru Dengan Alasan", banjarIds: [banjarId], status: "active", activationReason: "Sudah dikenal lama, verifikasi menyusul minggu ini" });
  expect(ok.ok, ok.error).toBe(true);
  expect((await users()).temples.find((t) => t.id === ok.value.id)!.status).toBe("active");
  const log = await (await admin.get("/api/admin/log")).text();
  expect(log).toContain("CONTOH Pura Baru Dengan Alasan (pura baru) — Diaktifkan sebelum checklist verifikasi lengkap (0/4). Alasan: Sudah dikenal lama");

  // Nonaktif → no reason needed.
  expect((await command(admin, "adminSaveTemple", { name: "CONTOH Pura Baru Nonaktif", banjarIds: [banjarId], status: "pending" })).ok).toBe(true);

  // Screen: the warning appears for "Aktif" and disappears for "Nonaktif".
  await signInUi(page, "admin@contoh.id");
  await page.goto("/app/admin");
  await page.getByRole("button", { name: /Tambah pura/ }).click();
  const dlg = page.getByRole("dialog");
  await dlg.locator("#tp-name").fill("CONTOH Pura Baru Lewat Layar");
  // The form starts as "Nonaktif" (decision Phase 3.4): no warning, no reason needed.
  await expect(dlg.getByLabel("Status")).toHaveValue("pending");
  await expect(dlg.getByText(/belum punya checklist verifikasi/)).toHaveCount(0);
  // Choosing "Aktif" shows the warning; saving without a reason is refused.
  await dlg.getByLabel("Status").selectOption("active");
  await expect(dlg.getByText("Pura baru belum punya checklist verifikasi (0/4).")).toBeVisible();
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(/Tulis alasan \(minimal 5 huruf\)/)).toBeVisible();
  await dlg.getByLabel("Alasan mengaktifkan sekarang (wajib)").fill("Uji layar: pura baru langsung aktif");
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Pura ditambahkan")).toBeVisible();
  expect((await users()).temples.find((t) => t.name === "CONTOH Pura Baru Lewat Layar")!.status).toBe("active");
});

test("Tambah pura dengan status bawaan Nonaktif: tersimpan tanpa alasan dan belum tampil di publik", async ({ page }) => {
  await signInUi(page, "admin@contoh.id");
  await page.goto("/app/admin");
  await page.getByRole("button", { name: /Tambah pura/ }).click();
  const dlg = page.getByRole("dialog");
  await dlg.locator("#tp-name").fill("CONTOH Pura Baru Bawaan Nonaktif");
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Pura ditambahkan")).toBeVisible();
  const admin = await pw.newContext({ baseURL: BASE });
  await signInApi(admin, "admin@contoh.id");
  const t = ((await (await admin.get("/api/admin/users")).json()).temples as { name: string; status: string }[]).find((x) => x.name === "CONTOH Pura Baru Bawaan Nonaktif")!;
  expect(t.status).toBe("pending");
  expect((await publicData(await pw.newContext({ baseURL: BASE }))).temples.some((x) => x.name === "CONTOH Pura Baru Bawaan Nonaktif")).toBe(false);
});
