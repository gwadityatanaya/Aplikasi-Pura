import { expect, request as pw, test } from "@playwright/test";
import { execFileSync } from "child_process";
import postgres from "postgres";
import { signInApi, signInUi } from "./helpers";

// Phase 3.4 tahap 4 — script to change the Admin Utama's email; backup reminder; numbers dashboard.
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3100";
const sql = () => postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
const script = (...args: string[]) =>
  execFileSync("npx", ["tsx", "scripts/admin-email.ts", ...args], { env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL, DATABASE_URL_UNPOOLED: "" }, encoding: "utf8" });

test("skrip ganti email Admin Utama: akun & riwayat sama, sesi lama keluar, Google lama tidak berlaku, tercatat", async () => {
  const before = await pw.newContext({ baseURL: BASE });
  await signInApi(before, "admin@contoh.id");
  const db = sql();
  const [admin] = await db`select id, email from users where is_super_admin`;
  await db`update users set google_sub = 'google-lama-uji' where id = ${admin.id}`;
  const logCount = (await db`select count(*)::int as n from activity_log where actor_id = ${admin.id}`)[0].n;

  expect(script("--email-baru=admin.sementara@contoh.id")).toContain("Jalankan lagi dengan --ya"); // nothing changed yet
  expect((await db`select email from users where id = ${admin.id}`)[0].email).toBe("admin@contoh.id");
  expect(() => script("--email-baru=made@contoh.id", "--ya")).toThrow(); // used by another account
  expect(script("--email-baru=admin.sementara@contoh.id", "--ya")).toContain("Email Admin Utama diganti");

  const [after] = await db`select id, email, google_sub, is_super_admin from users where id = ${admin.id}`;
  expect(after).toMatchObject({ id: admin.id, email: "admin.sementara@contoh.id", google_sub: null, is_super_admin: true });
  expect((await before.get("/api/admin/users")).status()).toBe(401); // old sessions signed out
  expect((await db`select count(*)::int as n from activity_log where actor_id = ${admin.id}`)[0].n).toBeGreaterThan(logCount); // history kept, change logged
  const [entry] = await db`select detail from activity_log where action = 'Mengganti email Admin Utama' order by at desc limit 1`;
  expect(entry.detail).toContain("admin.sementara@contoh.id");

  const now = await pw.newContext({ baseURL: BASE });
  await signInApi(now, "admin.sementara@contoh.id");
  expect((await (await now.get("/api/state")).json()).state.access.isSuperAdmin).toBe(true);

  // Back to the demo address for the other tests.
  expect(script("--email-baru=admin@contoh.id", "--ya")).toContain("Email Admin Utama diganti");
  await db.end();
});

test("pengingat cadangan di Back Office hilang setelah cadangan dibuat", async ({ page }) => {
  await signInUi(page, "admin@contoh.id");
  const db = sql();
  const [{ n }] = await db`select count(*)::int as n from activity_log where entity = 'backup' and at > now() - interval '7 days'`;
  await db.end();
  await page.goto("/app/admin");
  if (!n) await expect(page.getByRole("alert").filter({ hasText: /Belum pernah membuat cadangan data|Cadangan terakhir/ })).toBeVisible();
  const r = await page.request.get("/api/admin/backup");
  expect(r.status()).toBe(200);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Back Office" })).toBeVisible();
  await expect(page.getByText(/Belum pernah membuat cadangan data|Cadangan terakhir \d+ hari lalu/)).toHaveCount(0);
});

test("dasbor angka: hanya Admin Utama, berisi angka tanpa nama donatur", async ({ page }) => {
  const made = await pw.newContext({ baseURL: BASE });
  await signInApi(made, "made@contoh.id");
  expect((await made.get("/api/admin/statistik")).status()).toBe(403);

  const admin = await pw.newContext({ baseURL: BASE });
  await signInApi(admin, "admin@contoh.id");
  const raw = await (await admin.get("/api/admin/statistik")).text();
  const { stats } = JSON.parse(raw);
  expect(stats.banjarActive).toBeGreaterThan(0);
  expect(stats.templeActive).toBeGreaterThan(0);
  expect(stats.months).toHaveLength(12);
  expect(stats.months.reduce((n: number, m: { count: number }) => n + m.count, 0)).toBeGreaterThan(0);
  for (const name of ["Ni Luh Ayu Lestari", "I Nyoman Darma", "Keluarga I Ketut Rai", "ayu@contoh.id", "nyoman@contoh.id"]) expect(raw).not.toContain(name);

  await signInUi(page, "admin@contoh.id");
  await page.goto("/app/admin?tab=angka");
  await expect(page.getByLabel("Ringkasan angka")).toContainText("Pura aktif");
  await expect(page.getByRole("list", { name: "Punia per bulan" }).getByRole("listitem")).toHaveCount(12);
  await expect(page.locator("main")).not.toContainText("Nyoman Darma");
});
