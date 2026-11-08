import { expect, type Page, test } from "@playwright/test";
import { command, signInApi, signInUi } from "./helpers";
import { request as pw } from "@playwright/test";

// Cascading address dropdowns (Provinsi › Kabupaten/Kota › Kecamatan › Desa/Kelurahan) in the
// Back Office, backed by the bundled Kemendagri region list.
test.describe.configure({ mode: "serial" });

/** Opens a level's list, types to search, picks an option; focus must stay in the box. */
async function pick(page: Page, id: string, search: string, option: string) {
  const box = page.locator(`#${id}`);
  await box.click();
  await page.keyboard.type(search, { delay: 40 });
  await expect(box).toBeFocused();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(box).toHaveValue(option);
  await expect(box).toBeFocused();
}

async function adminData() {
  const ctx = await pw.newContext({ baseURL: "http://localhost:3100" });
  await signInApi(ctx, "admin@contoh.id");
  return (await (await ctx.get("/api/admin/users")).json()) as {
    banjars: Record<string, string | null>[];
    temples: Record<string, string | null>[];
  };
}

test("banjar: pilih bertingkat, ganti provinsi mengosongkan tingkat bawah, isian manual 'tidak ada di daftar'", async ({ page }) => {
  await signInUi(page, "admin@contoh.id");
  await page.goto("/app/admin");
  await page.getByRole("tab", { name: "Banjar" }).click();
  await page.getByRole("button", { name: /Tambah banjar/ }).click();
  await page.locator("#bj-name").fill("Banjar Uji Wilayah");

  // Lower levels wait for the level above.
  await expect(page.getByText("Pilih provinsi terlebih dahulu.")).toBeVisible();
  await pick(page, "bj-province", "bali", "Bali");
  await pick(page, "bj-regency", "badung", "Kabupaten Badung");
  await pick(page, "bj-district", "kuta sel", "Kuta Selatan");
  await pick(page, "bj-village", "jimb", "Jimbaran");

  // Only children of the chosen level are offered.
  await page.locator("#bj-district").click();
  await page.keyboard.type("ubud");
  await expect(page.getByRole("option", { name: "Ubud", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape"); // closes only the list
  await expect(page.getByRole("dialog")).toBeVisible();

  // Changing the province empties everything below.
  await pick(page, "bj-province", "nusa tenggara barat", "Nusa Tenggara Barat");
  await expect(page.locator("#bj-regency")).toHaveValue("");
  await expect(page.getByText("Pilih kabupaten/kota terlebih dahulu.")).toBeVisible();
  await expect(page.locator("#bj-village")).toHaveCount(0);

  // Back to Bali › Tabanan, then a kecamatan that is not in the list (manual), desa follows manual.
  await pick(page, "bj-province", "bali", "Bali");
  await pick(page, "bj-regency", "tabanan", "Kabupaten Tabanan");
  await page.locator("#bj-district").click();
  await page.keyboard.type("pemekaran");
  await page.getByRole("option", { name: /Tidak ada di daftar/ }).click();
  await page.locator("#bj-district").pressSequentially("Kecamatan Pemekaran Uji", { delay: 20 });
  await expect(page.locator("#bj-district")).toHaveValue("Kecamatan Pemekaran Uji");
  await expect(page.getByText(/Diisi manual karena kecamatan di atas diisi manual/)).toBeVisible();
  await page.locator("#bj-village").pressSequentially("Desa Uji Baru", { delay: 20 });
  await page.locator("#bj-addr").fill("Jl. Uji No. 1");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const b = (await adminData()).banjars.find((x) => x.name === "Banjar Uji Wilayah")!;
  expect(b).toMatchObject({
    province: "Bali", provinceCode: "51", regency: "Kabupaten Tabanan", regencyCode: "51.02",
    district: "Kecamatan Pemekaran Uji", village: "Desa Uji Baru", address: "Jl. Uji No. 1",
  });
  expect(b.districtCode ?? null).toBeNull();
  expect(b.villageCode ?? null).toBeNull();
});

test("pura: lokasi lengkap dari dropdown; pura tanpa alamat tetap bisa disimpan", async ({ page }) => {
  await signInUi(page, "admin@contoh.id");
  await page.goto("/app/admin");
  await page.getByRole("button", { name: /Tambah pura/ }).click();
  await page.locator("#tp-name").fill("CONTOH Pura Uji Wilayah");
  await pick(page, "tp-province", "bali", "Bali");
  await pick(page, "tp-regency", "badung", "Kabupaten Badung");
  await pick(page, "tp-district", "mengwi", "Mengwi");
  await pick(page, "tp-village", "kapal", "Kapal");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: /Tambah pura/ }).click();
  await page.locator("#tp-name").fill("CONTOH Pura Tanpa Alamat Uji");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const temples = (await adminData()).temples;
  expect(temples.find((t) => t.name === "CONTOH Pura Uji Wilayah")).toMatchObject({
    province: "Bali", regency: "Kabupaten Badung", district: "Mengwi", village: "Kapal",
    provinceCode: "51", regencyCode: "51.03", districtCode: "51.03.02", villageCode: "51.03.02.1004",
  });
  const bare = temples.find((t) => t.name === "CONTOH Pura Tanpa Alamat Uji")!;
  expect(bare).toMatchObject({ province: "", regency: "", district: "", village: "" });
});

test("server menolak kode wilayah palsu atau yang tidak bersambung", async ({ page }) => {
  await signInApi(page.request, "admin@contoh.id");
  const banjarIds = [(await adminData()).banjars[0].id as string];
  const fake = await command(page.request, "adminSaveTemple", { name: "CONTOH Pura Kode Palsu", banjarIds, provinceCode: "99" });
  expect(fake.ok).toBe(false);
  const broken = await command(page.request, "adminSaveTemple", { name: "CONTOH Pura Tidak Bersambung", banjarIds, provinceCode: "51", regencyCode: "52.01" });
  expect(broken.ok).toBe(false);
  // Names always come from the region list, not from what the browser sends.
  const ok = await command<{ id: string }>(page.request, "saveBanjar", { name: "Banjar Uji Nama", provinceCode: "51", province: "Nama Palsu" });
  expect(ok.ok, ok.error).toBe(true);
  expect((await adminData()).banjars.find((b) => b.name === "Banjar Uji Nama")?.province).toBe("Bali");
});

test("halaman publik: cari dan saring pura berdasarkan kabupaten", async ({ page }) => {
  await page.goto("/pura?q=gianyar");
  await expect(page.getByText("CONTOH Pura Taman Tunjung")).toBeVisible();
  await expect(page.getByText("CONTOH Pura Dalem Kahyangan")).toHaveCount(0);

  await page.goto("/pura");
  await page.getByLabel("Filter lokasi").selectOption("Kabupaten Badung");
  await expect(page.getByText("CONTOH Pura Dalem Kahyangan")).toBeVisible();
  await expect(page.getByText("CONTOH Pura Taman Tunjung")).toHaveCount(0);
  await expect(page.getByText(/Mengwi, Kabupaten Badung/).first()).toBeVisible();
});
