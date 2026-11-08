import { expect, type Page, test } from "@playwright/test";
import { publicData, signInUi } from "./helpers";

// No page may be wider than the screen (no sideways scrolling) — phones, tablets, laptop,
// portrait and landscape. A screenshot of every page × size is attached to the test report.
const SIZES = [
  { w: 320, h: 640 }, { w: 360, h: 740 }, { w: 390, h: 844 }, { w: 412, h: 915 },
  { w: 768, h: 1024 }, { w: 820, h: 1180 }, { w: 1024, h: 1366 }, { w: 1280, h: 800 },
  { w: 740, h: 360, landscape: true }, { w: 915, h: 412, landscape: true },
];

async function checkPage(page: Page, path: string, name: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  for (const s of SIZES) {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const cw = de.clientWidth;
      // The first element sticking out, to make a failure easy to trace.
      const clipped = (el: Element) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).overflowX !== "visible") return true;
        return false;
      };
      const out = Array.from(document.querySelectorAll("body *")).find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > cw + 1 || r.left < -1) && getComputedStyle(el).position !== "fixed" && !clipped(el);
      });
      return { sw: de.scrollWidth, cw, culprit: out ? `${out.tagName.toLowerCase()}.${String(out.className).slice(0, 80)}` : "" };
    });
    await test.info().attach(`${name}-${s.w}x${s.h}${s.landscape ? "-landscape" : ""}.png`, { body: await page.screenshot(), contentType: "image/png" });
    expect(m.sw, `${name} @${s.w}x${s.h}: lebar dokumen ${m.sw} > layar ${m.cw} (${m.culprit})`).toBeLessThanOrEqual(m.cw);
  }
}

test("halaman publik pas dengan lebar layar", async ({ page }) => {
  test.setTimeout(240_000);
  const slug = (await publicData(page.request)).temples.find((t) => t.name.includes("Dalem Kahyangan"))!.slug;
  await checkPage(page, "/", "beranda");
  await checkPage(page, "/pura", "daftar-pura");
  await checkPage(page, `/pura/${slug}`, "halaman-pura");
  await checkPage(page, "/pasang", "pasang-di-hp");
  await checkPage(page, "/masuk", "masuk");
  await checkPage(page, "/ajukan-pendaftaran", "ajukan-pendaftaran");
});

test("dashboard pengurus pas dengan lebar layar", async ({ page }) => {
  test.setTimeout(240_000);
  await signInUi(page, "made@contoh.id");
  await checkPage(page, "/app", "dashboard");
  await checkPage(page, "/app/punia", "verifikasi-punia");
  await checkPage(page, "/app/laporan", "laporan");
  await checkPage(page, "/app/pengaturan?tab=profil-admin", "profil-saya");
  await checkPage(page, "/bantuan", "bantuan");
  await checkPage(page, "/app/kegiatan", "kegiatan");
  await checkPage(page, "/app/campaign/baru", "form-penggalangan");
  await checkPage(page, "/app/pengaturan?tab=rekening", "kas-saldo-awal");
});

test("halaman berpunia umat pas dengan lebar layar (pilihan rekening)", async ({ page }) => {
  test.setTimeout(120_000);
  const slug = (await publicData(page.request)).temples.find((t) => t.name.includes("Dalem Kahyangan"))!.slug;
  await signInUi(page, "ayu@contoh.id");
  await checkPage(page, `/pura/${slug}/punia`, "berpunia");
});

test("Back Office pas dengan lebar layar", async ({ page }) => {
  test.setTimeout(180_000);
  await signInUi(page, "admin@contoh.id");
  await checkPage(page, "/app/admin", "back-office");
  await checkPage(page, "/app/admin?tab=bantuan", "back-office-bantuan");
  await checkPage(page, "/app/admin?tab=pengajuan", "back-office-pengajuan");
  await checkPage(page, "/app/admin?tab=angka", "back-office-angka");
  // Verification notes dialog (and the registration form inside the Back Office) on a small phone.
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/app/admin");
  await page.locator("li", { hasText: "Pura Dalem Kahyangan" }).first().getByRole("button", { name: "Verifikasi" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth), "dialog verifikasi @320").toBeLessThanOrEqual(320);
  const dialogBox = await page.getByRole("dialog").boundingBox();
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(321);
});

test("Punia Saya dan bukti pencatatan punia pas dengan lebar layar", async ({ page }) => {
  test.setTimeout(180_000);
  await signInUi(page, "ayu@contoh.id");
  await checkPage(page, "/umat/punia", "punia-saya");
  const { json } = await page.evaluate(async () => ({ json: await (await fetch("/api/umat")).json() }));
  await checkPage(page, `/umat/punia/${json.punia[0].id}`, "bukti-punia");
});

test("menu HP: panel penuh setinggi layar, latar solid, halaman terkunci, bisa ditutup", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pasang");
  await page.getByRole("button", { name: "Buka menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await page.waitForTimeout(500);
  const box = (await menu.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(840);
  expect(await menu.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toMatch(/rgba\(.*, 0\)|transparent/);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await test.info().attach("menu-hp.png", { body: await page.screenshot(), contentType: "image/png" });
  await page.getByRole("button", { name: "Tutup menu" }).click();
  await expect(menu).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("ukuran huruf Sangat besar: tetap tanpa gulir ke samping (HP, tablet, laptop)", async ({ page }) => {
  test.setTimeout(420_000);
  await signInUi(page, "made@contoh.id");
  expect((await (await page.request.post("/api/commands", { data: { name: "updateUser", payload: { textSize: "sangat_besar" } }, headers: { origin: "http://localhost:3100" } })).json()).ok).toBe(true);
  await page.goto("/app");
  await expect(page.locator("html")).toHaveClass(/text-sangat-besar/);
  try {
    for (const [path, name] of [["/app", "besar-dashboard"], ["/app/punia", "besar-punia"], ["/app/laporan", "besar-laporan"], ["/app/kegiatan", "besar-kegiatan"], ["/app/pengaturan?tab=rekening", "besar-kas"], ["/umat/akun", "besar-akun"], ["/bantuan", "besar-bantuan"]] as const)
      await checkPage(page, path, name);
  } finally {
    await page.request.post("/api/commands", { data: { name: "updateUser", payload: { textSize: "normal" } }, headers: { origin: "http://localhost:3100" } });
  }
});
