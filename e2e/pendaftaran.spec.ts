import { expect, request as pw, test } from "@playwright/test";
import { execFileSync } from "child_process";
import postgres from "postgres";
import { clearRateLimits, command, signInApi, signInUi } from "./helpers";

// Phase 3.4 tahap 2 — public "Ajukan pendaftaran": no login, anti-spam, visible to Admin Utama only,
// turned into banjar + pura with one button, never gives any access by itself.
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3100";
const anon = () => pw.newContext({ baseURL: BASE });
const post = async (body: Record<string, unknown>) => {
  const ctx = await anon();
  const r = await ctx.post("/api/pendaftaran", { data: body, headers: { origin: BASE } });
  return { status: r.status(), json: (await r.json()) as { ok: boolean; error?: string } };
};
const form = (n: number) => ({
  banjarName: `CONTOH Banjar Pemohon ${n}`, templeName: `CONTOH Pura Pemohon ${n}`,
  provinceCode: "51", regencyCode: "51.03", districtCode: "51.03.02", villageCode: "51.03.02.2009",
  applicantName: "I Wayan Pemohon (contoh)", applicantPosition: "Kelian Banjar", whatsapp: `08123456700${n}`, googleEmail: `pemohon${n}@contoh.id`,
  referrerName: "I Made Referensi (contoh)", referrerContact: "081299990000", reason: "Ingin kas pura lebih terbuka untuk krama.", consent: true,
});
const sql = () => postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });

test("formulir publik tanpa login: wilayah bertingkat, pesan verifikasi manual, tanpa KTP", async ({ page }) => {
  await clearRateLimits();
  await page.goto("/ajukan-pendaftaran");
  await expect(page.getByRole("heading", { name: "Ajukan pendaftaran" })).toBeVisible();
  await expect(page.getByText(/KTP/).first()).toBeVisible(); // "Tanpa KTP atau nomor identitas."
  await expect(page.locator("#rg-prov, [id^=rg]").first()).toBeVisible();
  await page.locator("#rg-banjar").fill("CONTOH Banjar Formulir");
  await page.locator("#rg-pura").fill("CONTOH Pura Formulir");
  await page.locator("#rg-name").fill("Ni Made Pemohon (contoh)");
  await page.locator("#rg-pos").fill("Bendahara");
  await page.locator("#rg-wa").fill("081234567699");
  await page.locator("#rg-email").fill("pemohon.formulir@contoh.id");
  await page.locator("#rg-ref").fill("I Ketut Referensi (contoh)");
  await page.locator("#rg-refc").fill("081211112222");
  await page.locator("#rg-reason").fill("Banjar kami ingin mencatat punia dengan rapi.");
  await expect(page.getByRole("button", { name: "Kirim pengajuan" })).toBeDisabled(); // consent first
  await page.getByText(/Saya setuju data di formulir ini/).click();
  await page.getByRole("button", { name: "Kirim pengajuan" }).click();
  await expect(page.getByRole("heading", { name: "Pengajuan terkirim" })).toBeVisible();
  await expect(page.getByText(/memverifikasi secara manual/)).toBeVisible();
  await expect(page.getByText(/belum.*memberi akses/)).toBeVisible();
});

test("anti-spam: kirim berulang dibatasi, nomor/email yang sama ditolak, bot (honeypot) diabaikan", async () => {
  await clearRateLimits();
  const db = sql();
  const before = (await db`select count(*)::int as n from registration_requests`)[0].n;
  expect((await post({ ...form(1), website: "http://spam.example" })).json.ok).toBe(true); // bot: silently ignored
  expect((await db`select count(*)::int as n from registration_requests`)[0].n).toBe(before);
  expect((await post({ ...form(1), consent: false })).json.ok).toBe(false);
  expect((await post(form(1))).json.ok).toBe(true);
  const dup = await post({ ...form(2), whatsapp: form(1).whatsapp });
  expect(dup.status).toBe(409);
  expect(dup.json.error).toMatch(/sudah kami terima/);
  expect((await post(form(3))).json.ok).toBe(true);
  const fourth = await post(form(4)); // 3 per network per day (the duplicate attempt counted too)
  expect(fourth.status).toBe(429);
  expect(fourth.json.error).toMatch(/Coba lagi besok/);
  const [row] = await db`select province, regency, district, village, village_code from registration_requests where google_email = 'pemohon1@contoh.id'`;
  expect(row).toMatchObject({ province: "Bali", village_code: "51.03.02.2009" });
  expect(row.regency).toMatch(/Badung/);
  await db.end();
  await clearRateLimits();
});

test("hanya Admin Utama yang melihat data pemohon; tidak ada di data publik atau Log", async () => {
  const made = await anon();
  await signInApi(made, "made@contoh.id");
  expect((await made.get("/api/admin/pendaftaran")).status()).toBe(403);
  expect((await (await anon()).get("/api/admin/pendaftaran")).status()).toBe(401);
  expect(await (await (await anon()).get("/api/public")).text()).not.toContain("081234567001");
  const admin = await anon();
  await signInApi(admin, "admin@contoh.id");
  const list = (await (await admin.get("/api/admin/pendaftaran")).json()).requests as { whatsapp: string }[];
  expect(list.some((r) => r.whatsapp === "081234567001")).toBe(true);
  const log = await (await admin.get("/api/admin/log")).text();
  expect(log).toContain("Pengajuan pendaftaran baru");
  expect(log).not.toContain("081234567001");
  expect(log).not.toContain("pemohon1@contoh.id");
});

test("Admin Utama: status & catatan internal, lalu satu tombol menjadi banjar & pura — tanpa membuat akses", async ({ page }) => {
  await signInUi(page, "admin@contoh.id");
  await page.goto("/app/admin?tab=pengajuan");
  await expect(page.getByRole("tab", { name: /^Pengajuan \(\d+\)$/ })).toBeVisible();
  const card = page.locator("li").filter({ hasText: "CONTOH Banjar Pemohon 1" });
  await card.getByRole("button", { name: /CONTOH Banjar Pemohon 1/ }).click();
  await expect(card).toContainText("081234567001");
  await card.getByLabel("Status").selectOption("verifikasi");
  await card.getByLabel(/Catatan internal/).fill("Referensi sudah ditelepon, benar Kelian Banjar.");
  await card.getByRole("button", { name: "Simpan status & catatan" }).click();
  await expect(page.getByText("Pengajuan disimpan")).toBeVisible();
  await expect(card).toContainText("Sedang diverifikasi");

  await card.getByRole("button", { name: "Jadikan banjar & pura" }).click();
  await page.getByRole("button", { name: "Ya, buat" }).click();
  await expect(page.getByText("Banjar & pura dibuat dari pengajuan")).toBeVisible();

  const admin = await anon();
  await signInApi(admin, "admin@contoh.id");
  const data = await (await admin.get("/api/admin/users")).json();
  const temple = data.temples.find((t: { name: string }) => t.name === "CONTOH Pura Pemohon 1");
  const banjar = data.banjars.find((b: { name: string }) => b.name === "CONTOH Banjar Pemohon 1");
  expect(temple).toBeTruthy();
  expect(banjar).toBeTruthy();
  expect(temple.status).toBe("pending"); // not public yet
  expect(temple.banjarIds).toContain(banjar.id);
  expect(temple.village).toBe(banjar.village); // filled from the request
  // No account, role or access was created for the applicant.
  expect(data.users.some((u: { email: string }) => u.email === "pemohon1@contoh.id")).toBe(false);
  expect(data.memberships.some((m: { templeId: string }) => m.templeId === temple.id)).toBe(false);
  expect(((await (await (await anon()).get("/api/public")).json()).data.temples as { name: string }[]).some((t) => t.name === "CONTOH Pura Pemohon 1")).toBe(false);
  // Converting twice is refused.
  const reqs = (await (await admin.get("/api/admin/pendaftaran")).json()).requests as { id: string; googleEmail: string; status: string }[];
  const r = reqs.find((x) => x.googleEmail === "pemohon1@contoh.id")!;
  expect(r.status).toBe("disetujui");
  expect((await command(admin, "adminConvertRegistration", { id: r.id })).ok).toBe(false);
  const log = await (await admin.get("/api/admin/log")).text();
  expect(log).toContain("Menyetujui pengajuan pendaftaran");
});

// Decision Phase 3.4: rejected requests are deleted automatically 6 months after their last change.
test("pengajuan Ditolak dihapus otomatis setelah 6 bulan; yang lain tetap; tercatat jumlahnya", async () => {
  const db = postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
  const row = (id: string, status: string, monthsAgo: number) => ({
    id, banjar_name: `CONTOH Banjar Hapus ${id}`, temple_name: "CONTOH Pura Hapus", applicant_name: "Pemohon (contoh)", applicant_position: "Kelian",
    whatsapp: "080000000000", google_email: `${id}@contoh.id`, referrer_name: "Ref (contoh)", referrer_contact: "080000000001", reason: "uji hapus otomatis",
    consent_at: new Date(), status, updated_at: new Date(Date.now() - monthsAgo * 31 * 86400_000),
  });
  try {
    await db`insert into registration_requests ${db([row("rg_tolak_lama", "ditolak", 7), row("rg_tolak_baru", "ditolak", 5), row("rg_baru_lama", "baru", 7)])}`;
    const out = execFileSync("npx", ["tsx", "--require", "./scripts/allow-server-only.cjs", "-e", 'import("./src/server/commands-admin").then((m) => (m.cleanupRejectedRegistrations ?? m.default.cleanupRejectedRegistrations)()).then((n) => { console.log("DIHAPUS=" + n); process.exit(0); })'], {
      env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL!, DATABASE_URL_UNPOOLED: process.env.E2E_DATABASE_URL! },
      encoding: "utf8",
    });
    expect(out).toContain("DIHAPUS=1");
    const left = (await db<{ id: string }[]>`select id from registration_requests where id like 'rg_%_%' and id in ('rg_tolak_lama','rg_tolak_baru','rg_baru_lama')`).map((r) => r.id).sort();
    expect(left).toEqual(["rg_baru_lama", "rg_tolak_baru"]);
    const [log] = await db<{ detail: string }[]>`select detail from activity_log where action = 'Menghapus pengajuan pendaftaran yang ditolak' order by at desc limit 1`;
    expect(log.detail).toContain("1 pengajuan berstatus Ditolak");
    expect(log.detail).not.toContain("rg_tolak_lama@contoh.id");
  } finally {
    await db`delete from registration_requests where id in ('rg_tolak_baru','rg_baru_lama')`;
    await db.end();
  }
});
