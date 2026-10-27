import { expect, type Locator, type Page, test } from "@playwright/test";
import { command, publicData, signInUi } from "./helpers";

// Regression test: typing in a dialog field moved focus to the dialog's close (X) button after the
// first character, because the dialog re-ran its "focus the first element" effect on every render.
// Each check types several characters one by one (with spaces — a space on a focused X button
// would close the dialog) and verifies that ALL text arrived and focus stayed in the field.
// Nothing is saved: dialogs are closed again with Escape.

const TEXT = "Pura Desa 123 ok";

async function typeSlowly(page: Page, field: Locator, text = TEXT) {
  await expect(field).toBeVisible();
  await field.fill("");
  await field.click();
  await page.keyboard.type(text, { delay: 60 });
  await expect(field).toHaveValue(text);
  await expect(field).toBeFocused();
}

async function closeDialog(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test.describe.configure({ mode: "serial" });

test("Back Office: Tambah pura, Tambah banjar, Rekening, Pengurus, Ganti email, Mode darurat", async ({ page }) => {
  await signInUi(page, "admin@contoh.id");
  await page.goto("/app/admin");

  await page.getByRole("button", { name: /Tambah pura/ }).click();
  // The dialog opens with focus in the first field, not on the close button.
  await expect(page.locator("#tp-name")).toBeFocused();
  await typeSlowly(page, page.locator("#tp-name"));
  await typeSlowly(page, page.locator("#tp-addr"));
  await typeSlowly(page, page.locator("#tp-desc"), "Catatan\nbaris dua");
  await closeDialog(page);

  await page.getByRole("button", { name: /Rekening/ }).first().click();
  await typeSlowly(page, page.locator("#bk-name"));
  await typeSlowly(page, page.locator("#bk-holder"));
  await closeDialog(page);

  await page.getByRole("button", { name: /^Pengurus$/ }).first().click();
  await typeSlowly(page, page.locator("#st-email"), "orang.baru@contoh.id");
  await closeDialog(page);

  await page.getByRole("tab", { name: "Banjar" }).click();
  await page.getByRole("button", { name: /Tambah banjar/ }).click();
  await typeSlowly(page, page.locator("#bj-name"));
  await closeDialog(page);

  await page.getByRole("tab", { name: "Akun" }).click();
  await page.getByRole("button", { name: /Ganti email/ }).first().click();
  await typeSlowly(page, page.locator("#ce-email"), "nama.baru@contoh.id");
  await closeDialog(page);

  await page.getByRole("tab", { name: "Pura" }).click();
  await page.getByRole("button", { name: /Buka dashboard/ }).first().click();
  await page.waitForURL(/\/app$/);
  await page.getByRole("button", { name: /Mode darurat/ }).click();
  await typeSlowly(page, page.locator("#em-reason"), "Alasan darurat untuk uji");
  await closeDialog(page);
});

test("Pengurus: Input punia manual, Tolak, Koreksi, Pengaturan", async ({ page }) => {
  await signInUi(page, "made@contoh.id");
  const dalem = (await publicData(page.request)).temples.find((t) => t.name.endsWith("Pura Dalem Kahyangan"))!;
  await command(page.request, "setActiveTemple", { templeId: dalem.id });

  await page.goto("/app/punia?input=1");
  await typeSlowly(page, page.locator("#mp-name"), "Keluarga Bapak Uji");
  await typeSlowly(page, page.locator("#mp-email"), "donatur@contoh.id");
  await typeSlowly(page, page.locator("#mp-ref"), "REF 123");
  await typeSlowly(page, page.locator("#mp-msg"));
  await closeDialog(page);

  // Tolak (pending punia from the demo data)
  await page.locator("ul li button.text-left").first().click();
  await page.getByRole("button", { name: /^Tolak$/ }).click();
  await typeSlowly(page, page.locator("#rj-reason"), "Bukti kurang jelas, mohon kirim ulang");
  await closeDialog(page);

  // Koreksi (a punia that is already disahkan)
  await page.getByRole("tab", { name: "Disahkan" }).click();
  await page.locator("ul li button.text-left").first().click();
  await page.getByRole("button", { name: /Koreksi punia ini/ }).click();
  await typeSlowly(page, page.locator("#kr-reason"), "Nominal salah ketik");
  await closeDialog(page);

  await page.goto("/app/pengaturan?tab=profil-pura");
  await typeSlowly(page, page.locator("#t-desc"));
  await typeSlowly(page, page.locator("#t-phone"), "0812 000 111");
  await page.goto("/app/pengaturan?tab=profil-admin");
  await typeSlowly(page, page.locator("#u-name"), "I Made Uji Ketik");

  // Dialogs inside Pengaturan: new category, new cash account
  await page.goto("/app/pengaturan?tab=kategori");
  await page.getByRole("button", { name: /^Tambah$/ }).first().click();
  await typeSlowly(page, page.locator("#k-name"), "Kategori uji ketik");
  await closeDialog(page);
  await page.goto("/app/pengaturan?tab=rekening");
  await page.getByRole("button", { name: /^Tambah$/ }).first().click();
  await typeSlowly(page, page.locator("#ac-name"), "Kas uji ketik");
  await closeDialog(page);
});

test("Umat: Kirim punia, Akun saya, konfirmasi Hapus akun", async ({ page }) => {
  await signInUi(page, "nyoman@contoh.id");
  const dalem = (await publicData(page.request)).temples.find((t) => t.name.endsWith("Pura Dalem Kahyangan"))!;
  await page.goto(`/pura/${dalem.slug}/punia`);
  await typeSlowly(page, page.locator("#pn-ref"), "REF 98765");
  await typeSlowly(page, page.locator("#pn-msg"));

  await page.goto("/umat/akun");
  await typeSlowly(page, page.locator("#ak-name"), "I Nyoman Uji Ketik");
  await typeSlowly(page, page.locator("#ak-phone"), "0812 3456 789");
  await page.getByRole("button", { name: /Hapus akun saya/ }).click();
  const confirm = page.getByLabel("Ketik HAPUS");
  await expect(confirm).toBeFocused(); // danger dialog starts in the field, not on the delete button
  await typeSlowly(page, confirm, "HAP");
  await closeDialog(page);
});
