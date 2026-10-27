import { expect, request as pw, test } from "@playwright/test";
import postgres from "postgres";
import { command, receipt, signInApi, signInUi } from "./helpers";

// Phase 3.2 tahap 5 — profile photo: crop + resize on the device, visible only to the owner,
// related Pengurus Pura / Pengurus Banjar and Admin Utama; never public, never next to punia.
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3100";
async function as(email: string) {
  const ctx = await pw.newContext({ baseURL: BASE });
  await signInApi(ctx, email);
  return ctx;
}
const dataUrl = (b: Buffer, mime = "image/png") => `data:${mime};base64,${b.toString("base64")}`;
const sql = () => postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
let madeId = "";

test("unggah lewat Profil saya: dipotong persegi dan diperkecil di perangkat; file bukan gambar ditolak", async ({ page }) => {
  await signInUi(page, "made@contoh.id");
  await page.goto("/app/pengaturan?tab=profil-admin");
  // Not an image → refused before anything is sent.
  await page.getByLabel("Pilih foto profil").setInputFiles({ name: "catatan.txt", mimeType: "text/plain", buffer: Buffer.from("bukan foto") });
  await expect(page.getByText("Pilih foto berformat JPG, PNG, atau WEBP.")).toBeVisible();

  await page.getByLabel("Pilih foto profil").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: receipt(501) });
  await expect(page.getByRole("dialog").getByText("Potong foto")).toBeVisible();
  await page.getByLabel("Perbesar").fill("1.5");
  await page.getByRole("button", { name: "Simpan foto" }).click();
  await expect(page.getByText("Foto profil disimpan")).toBeVisible();

  const me = (await (await page.request.get("/api/state")).json()).state.me;
  madeId = me.id;
  expect(me.avatarVersion).toBeTruthy();
  const r = await page.request.get(`/api/avatar/${me.id}`);
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toMatch(/^image\/(webp|jpeg)$/);
  const body = await r.body();
  expect(body.length).toBeLessThanOrEqual(60_000);
  // 256 × 256, measured by the browser itself.
  const dim = await page.evaluate(async (src) => { const b = await createImageBitmap(await (await fetch(src)).blob()); return [b.width, b.height]; }, `/api/avatar/${me.id}`);
  expect(dim).toEqual([256, 256]);
  await expect(page.locator(`img[src^="/api/avatar/${me.id}"]`).filter({ visible: true }).first()).toBeVisible();
});

test("server menolak foto yang bukan gambar, terlalu besar, atau tidak persegi", async () => {
  const made = await as("made@contoh.id");
  expect((await command(made, "setMyAvatar", { image: "data:text/plain;base64,aGFsbw==" })).ok).toBe(false);
  const wide = Buffer.from(receipt(502));
  wide.writeUInt32BE(40, 16); // header says 40 × 16
  const notSquare = await command(made, "setMyAvatar", { image: dataUrl(wide) });
  expect(notSquare.ok).toBe(false);
  expect(notSquare.error).toMatch(/persegi/);
  const big = Buffer.concat([receipt(503), Buffer.alloc(120_000)]);
  expect((await command(made, "setMyAvatar", { image: dataUrl(big) })).ok).toBe(false);
});

test("siapa yang boleh melihat: pemilik, pengurus/banjar terkait, Admin Utama — bukan Pemeriksa, umat, atau publik", async ({ page }) => {
  const url = `/api/avatar/${madeId}`;
  for (const email of ["komang@contoh.id", "ketut.banjar@contoh.id", "admin@contoh.id"]) expect((await (await as(email)).get(url)).status(), email).toBe(200);
  for (const email of ["oka.pemeriksa@contoh.id", "ayu@contoh.id", "wayan@contoh.id"]) expect((await (await as(email)).get(url)).status(), email).toBe(403);
  const anon = await pw.newContext({ baseURL: BASE });
  expect((await anon.get(url)).status()).toBe(401);
  // The Pemeriksa's data does not even mention that a photo exists.
  const oka = await as("oka.pemeriksa@contoh.id");
  const users = (await (await oka.get("/api/state")).json()).state.data.users as { id: string; avatarVersion?: string }[];
  expect(users.find((u) => u.id === madeId)?.avatarVersion).toBeUndefined();
  // Public data and public pages carry no photos.
  expect(await (await anon.get("/api/public")).text()).not.toContain("avatar");
  await page.goto("/pura");
  await expect(page.locator('img[src*="/api/avatar/"]')).toHaveCount(0);
});

test("Admin Utama menghapus foto yang tidak pantas (dengan alasan, tercatat); foto benar-benar terhapus", async ({ page }) => {
  const db = sql();
  const [{ avatar_id: before }] = await db`select avatar_id from users where id = ${madeId}`;
  expect(before).toBeTruthy();
  await signInUi(page, "admin@contoh.id");
  await page.goto("/app/admin");
  await page.getByRole("tab", { name: "Akun", exact: true }).click();
  await page.locator("li").filter({ hasText: "made@contoh.id" }).getByRole("button", { name: "Hapus foto" }).click();
  await page.getByLabel("Alasan (wajib)").fill("Foto tidak pantas untuk aplikasi pura");
  await page.getByRole("dialog").getByRole("button", { name: "Hapus foto" }).click();
  await expect(page.getByText("Foto profil dihapus")).toBeVisible();
  expect((await page.request.get(`/api/avatar/${madeId}`)).status()).toBe(404);
  expect((await db`select count(*)::int as n from attachments where id = ${before}`)[0].n).toBe(0);
  await db.end();
  const log = await (await page.request.get("/api/admin/log")).text();
  expect(log).toContain("Menghapus foto profil orang lain");
  expect(log).toContain("Foto tidak pantas untuk aplikasi pura");
  // A pengurus cannot remove someone else's photo.
  expect((await command(await as("komang@contoh.id"), "adminRemoveAvatar", { userId: madeId, reason: "coba-coba" })).ok).toBe(false);
});

test("umat: foto di Akun saya; menghapus akun ikut menghapus fotonya", async ({ page }) => {
  await signInUi(page, "umat.foto@contoh.id");
  await page.goto("/umat/akun");
  await page.getByLabel("Pilih foto profil").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: receipt(504) });
  await page.getByRole("button", { name: "Simpan foto" }).click();
  await expect(page.getByText("Foto profil disimpan")).toBeVisible();
  const me = (await (await page.request.get("/api/state")).json()).state.me;
  const db = sql();
  const [{ avatar_id: photo }] = await db`select avatar_id from users where id = ${me.id}`;
  expect(photo).toBeTruthy();
  expect((await command(page.request, "deleteMyAccount", { confirm: "HAPUS" })).ok).toBe(true);
  expect((await db`select count(*)::int as n from attachments where id = ${photo}`)[0].n).toBe(0);
  expect((await db`select avatar_id from users where id = ${me.id}`)[0].avatar_id).toBeNull();
  await db.end();
});
