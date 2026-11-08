import { expect, request as pw, test } from "@playwright/test";
import postgres from "postgres";
import { command, publicData, signInApi, signInUi, today } from "./helpers";

// Phase 3.3 tahap 1 — menu "Kegiatan"; an empty kegiatan can be deleted, one with records only
// archived (also enforced by the database); Pengurus Pura, Pengurus Banjar and Admin Utama in
// mode darurat may do it, a Pemeriksa may not.
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3100";
async function as(email: string, temple?: string) {
  const ctx = await pw.newContext({ baseURL: BASE });
  await signInApi(ctx, email);
  if (temple) expect((await command(ctx, "setActiveTemple", { templeId: temple })).ok).toBe(true);
  return ctx;
}
type St = { data: { activities: { id: string; name: string; archivedAt?: string }[]; transactions: { activityId?: string }[]; accounts: { id: string }[]; categories: { id: string; type: string }[] } };
const state = async (ctx: Awaited<ReturnType<typeof as>>) => (await (await ctx.get("/api/state")).json()).state as St;
const sql = () => postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
let dalem = "";

test("menu bernama \"Kegiatan\"; tujuan punia \"Odalan / Piodalan\" tetap ada", async ({ page }) => {
  await signInUi(page, "made@contoh.id");
  dalem = (await publicData(page.request)).temples.find((t) => t.name.endsWith("Pura Dalem Kahyangan"))!.id;
  await command(page.request, "setActiveTemple", { templeId: dalem });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/app/kegiatan");
  await expect(page.getByRole("link", { name: "Kegiatan", exact: true }).first()).toBeVisible();
  await expect(page.getByText("Kegiatan / Odalan")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Kegiatan", exact: true })).toBeVisible();
  // Phone: the "Lainnya" menu uses the same name.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Menu lainnya" }).click();
  await expect(page.getByRole("dialog").getByText("Kegiatan", { exact: true })).toBeVisible();
  // The punia purpose (a category, not the menu) keeps its name.
  await page.goto("/app/punia?input=1");
  await expect(page.locator("option", { hasText: "Odalan / Piodalan" }).first()).toBeAttached();
});

test("kegiatan kosong yang salah dibuat bisa dihapus (dengan konfirmasi, tercatat)", async ({ page }) => {
  const made = await as("made@contoh.id", dalem);
  const r = await command<{ id: string }>(made, "saveActivity", { name: "Kegiatan Salah Ketik", description: "", startDate: today(), endDate: today(), budget: 0, fundType: "general", status: "planned", color: "#087F6D" });
  expect(r.ok, r.error).toBe(true);
  await signInUi(page, "made@contoh.id");
  await command(page.request, "setActiveTemple", { templeId: dalem });
  await page.goto(`/app/kegiatan/${r.value.id}`);
  await page.getByRole("button", { name: "Hapus" }).click();
  await page.getByRole("button", { name: "Hapus kegiatan" }).click();
  await expect(page.getByText("Kegiatan dihapus")).toBeVisible();
  await page.waitForURL(/\/app\/kegiatan$/);
  expect((await state(made)).data.activities.some((a) => a.id === r.value.id)).toBe(false);
  const audit = JSON.stringify((await (await made.get("/api/state")).json()).state.data.audit);
  expect(audit).toContain("Menghapus kegiatan");
});

test("kegiatan dengan data: hapus ditolak (aplikasi & database), hanya bisa diarsipkan; arsip menyembunyikan dari pilihan baru", async ({ page }) => {
  const made = await as("made@contoh.id", dalem);
  // Give a kegiatan a record: even a DRAFT transaction counts as data.
  const created = await command<{ id: string }>(made, "saveActivity", { name: "Kegiatan Uji Berdata", description: "", startDate: today(), endDate: today(), budget: 0, fundType: "general", status: "ongoing", color: "#087F6D" });
  let st = await state(made);
  const draft = await command(made, "addTransaction", {
    input: { type: "expense", amount: 7_000, date: today(), description: "Draf untuk kegiatan uji", accountId: st.data.accounts[0].id, categoryId: st.data.categories.find((c) => c.type === "expense")!.id, activityId: created.value.id, status: "draft" },
    key: "keg-draf-00001",
  });
  expect(draft.ok, draft.error).toBe(true);
  st = await state(made);
  const a = st.data.activities.find((x) => x.id === created.value.id)!;
  const del = await command(made, "deleteActivity", { id: a.id });
  expect(del.ok).toBe(false);
  expect(del.error).toMatch(/sudah memiliki data terkait.*Arsipkan/);
  const db = sql();
  await expect(db`delete from activities where id = ${a.id}`).rejects.toThrow(/tidak boleh dihapus/);
  await db.end();
  expect((await command(made, "archiveActivity", { id: a.id, reason: "" })).ok).toBe(false); // reason required

  // Archive through the screen.
  await signInUi(page, "made@contoh.id");
  await command(page.request, "setActiveTemple", { templeId: dalem });
  await page.goto(`/app/kegiatan/${a.id}`);
  await expect(page.getByRole("button", { name: "Hapus" })).toHaveCount(0); // has data: archive only
  await page.getByRole("button", { name: "Arsipkan" }).click();
  await page.getByLabel("Alasan (wajib)").fill("Dobel dengan kegiatan lain");
  await page.getByRole("button", { name: "Arsipkan kegiatan" }).click();
  await expect(page.getByText("Kegiatan diarsipkan", { exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Dobel dengan kegiatan lain" })).toBeVisible();

  // Hidden from new choices; new records with it are refused; old records stay.
  await page.goto("/app/transaksi/baru?type=expense");
  await expect(page.locator(`option[value="${a.id}"]`)).toHaveCount(0);
  await page.goto("/app/campaign/baru");
  await expect(page.locator(`option[value="${a.id}"]`)).toHaveCount(0);
  const add = await command(made, "addTransaction", {
    input: { type: "expense", amount: 5_000, date: today(), description: "Uji kegiatan arsip", accountId: st.data.accounts[0].id, categoryId: st.data.categories.find((c) => c.type === "expense")!.id, activityId: a.id, status: "confirmed" },
    key: "keg-arsip-0001",
  });
  expect(add.ok).toBe(false);
  expect(add.error).toMatch(/diarsipkan/);
  expect((await state(made)).data.transactions.filter((t) => t.activityId === a.id).length).toBeGreaterThan(0);
  await page.goto("/app/kegiatan");
  await page.getByRole("button", { name: /Lihat kegiatan diarsipkan/ }).click();
  await expect(page.getByText(a.name)).toBeVisible();

  // Reactivate.
  expect((await command(made, "unarchiveActivity", { id: a.id })).ok).toBe(true);
  const log = JSON.stringify((await (await made.get("/api/state")).json()).state.data.audit);
  expect(log).toContain("Mengarsipkan kegiatan");
  expect(log).toContain("Mengaktifkan kembali kegiatan");
});

test("siapa yang boleh: Pengurus Banjar ya, Pemeriksa tidak, Admin Utama hanya lewat mode darurat", async () => {
  const banjar = await as("ketut.banjar@contoh.id", dalem);
  const a = (await state(banjar)).data.activities.find((x) => !x.archivedAt)!;
  expect((await command(banjar, "archiveActivity", { id: a.id, reason: "Uji oleh Pengurus Banjar" })).ok).toBe(true);
  expect((await command(banjar, "unarchiveActivity", { id: a.id })).ok).toBe(true);

  const oka = await as("oka.pemeriksa@contoh.id", dalem);
  const no = await command(oka, "archiveActivity", { id: a.id, reason: "Pemeriksa mencoba" });
  expect(no.ok).toBe(false);
  expect((await command(oka, "deleteActivity", { id: a.id })).ok).toBe(false);

  const admin = await as("admin@contoh.id", dalem);
  const view = await command(admin, "archiveActivity", { id: a.id, reason: "Admin mode lihat" });
  expect(view.ok).toBe(false);
  expect(view.error).toMatch(/Mode darurat/i);
  expect((await command(admin, "startEmergency", { reason: "Uji arsip kegiatan oleh Admin Utama" })).ok).toBe(true);
  expect((await command(admin, "archiveActivity", { id: a.id, reason: "Uji mode darurat" })).ok).toBe(true);
  expect((await command(admin, "unarchiveActivity", { id: a.id })).ok).toBe(true);
  await command(admin, "endEmergency", {});
  const log = await (await admin.get("/api/admin/log")).text();
  expect(log).toContain("Mengarsipkan kegiatan — dilakukan oleh Admin Utama (mode darurat)");
});
