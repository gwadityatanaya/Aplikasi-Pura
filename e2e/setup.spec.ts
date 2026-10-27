import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { E2E_SETUP_TOKEN, SETUP_PORT, setupDbUrl } from "../playwright.config";

// A brand-new deployment: EMPTY database (no Admin Utama, no temples) on its own test server.
// Regression test for: after /setup, Back Office said "Peran Anda belum memiliki akses" because
// the page checked the role of the open temple — and there is no temple yet.
const BASE = `http://localhost:${SETUP_PORT}`;
test.use({ baseURL: BASE });
test.describe.configure({ mode: "serial" });

async function signInByLink(page: import("@playwright/test").Page, email: string) {
  const sql = postgres(setupDbUrl(), { max: 1, onnotice: () => {} });
  await sql`delete from rate_limits`;
  await sql.end();
  const r = await page.request.post("/api/auth/email-link", { data: { email }, headers: { origin: BASE } });
  const j = await r.json();
  expect(j.ok, j.error).toBe(true);
  await page.goto(j.devLink);
  await page.getByRole("button", { name: /Masuk sekarang/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/masuk"));
}

async function expectBackOffice(page: import("@playwright/test").Page) {
  await page.goto("/app/admin");
  await expect(page.getByRole("heading", { name: "Back Office" })).toBeVisible();
  await expect(page.getByText(/belum memiliki akses/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Tambah banjar/ }).or(page.getByRole("tab", { name: "Banjar" })).first()).toBeVisible();
  await page.goto("/app/log-aktivitas");
  await expect(page.getByText(/belum memiliki akses/)).toHaveCount(0);
  await expect(page.getByText("Setup Admin Utama").first()).toBeVisible();
}

test("setup pertama → Back Office langsung terbuka (belum ada pura sama sekali)", async ({ page }) => {
  await page.goto("/setup");
  await page.getByLabel(/Kode setup/i).fill(E2E_SETUP_TOKEN);
  await page.getByLabel(/Nama lengkap/i).fill("Admin Uji Baru");
  await page.getByLabel(/Email/i).fill("Admin.Baru@Contoh.id"); // different capitals than ADMIN_EMAIL
  await page.getByRole("button", { name: /Buat Admin Utama/ }).click();
  await page.waitForURL(/\/app\/admin/);
  const st = (await (await page.request.get("/api/state")).json()).state;
  expect(st.access.isSuperAdmin).toBe(true);
  expect(st.data.temples).toHaveLength(0);
  await expectBackOffice(page);

  await page.goto("/setup");
  await expect(page.getByText(/sudah selesai|sudah ada/i).first()).toBeVisible();
});

test("keluar, lalu masuk lagi dengan email yang sama → tetap Admin Utama dan Back Office terbuka", async ({ page }) => {
  // Google sign-in and the email link end in the same server function (signInWithEmail), which
  // matches the account by email (ignoring capitals). Google itself cannot be reached from tests,
  // so the email link is used here; the account lookup being tested is the same.
  await signInByLink(page, "admin.baru@contoh.id");
  await expect(page).toHaveURL(/\/app/);
  await expectBackOffice(page);
  const users = await (await page.request.get("/api/admin/users")).json();
  expect(users.ok).toBe(true);
  expect(users.users.filter((u: { isSuperAdmin: boolean }) => u.isSuperAdmin)).toHaveLength(1);
});
