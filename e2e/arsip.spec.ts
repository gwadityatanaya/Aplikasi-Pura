import { expect, request as pw, type APIRequestContext, test } from "@playwright/test";
import postgres from "postgres";
import { command, publicData, receiptDataUrl, signInApi, signInUi, today } from "./helpers";

// Phase 3.2 tahap 4 — archive / permanent delete of pura and banjar (Admin Utama only).
// A temple with data can only be archived (hidden, read-only, reversible); only an empty temple or
// a banjar without temples can be deleted, and the database enforces the same rules.
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3100";
const SEGARA = "CONTOH Pura Segara Bersama";
const BANJAR_B = "CONTOH Banjar Adat Tunjung Mekar";

async function as(email: string) {
  const ctx = await pw.newContext({ baseURL: BASE });
  await signInApi(ctx, email);
  return ctx;
}
async function adminData(admin: APIRequestContext) {
  return (await (await admin.get("/api/admin/users")).json()) as {
    temples: { id: string; name: string; slug: string; status: string }[];
    banjars: { id: string; name: string; status: string }[];
    memberships: { userId: string; templeId: string; status: string }[];
    banjarMembers: { banjarId: string; status: string }[];
  };
}
const sql = () => postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });

test("pura dengan transaksi: hapus ditolak (aplikasi & database), arsip menyembunyikan dan mengunci, lalu aktif kembali", async ({ page }) => {
  const admin = await as("admin@contoh.id");
  const segara = (await adminData(admin)).temples.find((t) => t.name === SEGARA)!;

  // Permanent delete is refused: the temple has transactions and punia.
  const del = await command(admin, "deleteTemple", { id: segara.id, confirmName: SEGARA, reason: "uji hapus" });
  expect(del.ok).toBe(false);
  expect(del.error).toMatch(/sudah memiliki data .*transaksi.*Arsipkan/);
  // ...also directly in the database (same rule, whatever the application does).
  const db = sql();
  await expect(db`delete from temples where id = ${segara.id}`).rejects.toThrow(/tidak boleh dihapus permanen/);
  // Name typed wrongly, or no reason → refused.
  expect((await command(admin, "archiveTemple", { id: segara.id, confirmName: "Pura Lain", reason: "pura tidak aktif lagi" })).error).toMatch(/tidak sama/);
  expect((await command(admin, "archiveTemple", { id: segara.id, confirmName: SEGARA, reason: "" })).ok).toBe(false);
  // Only Admin Utama.
  const made = await as("made@contoh.id");
  expect((await command(made, "archiveTemple", { id: segara.id, confirmName: SEGARA, reason: "bukan admin" })).ok).toBe(false);

  // Archive through the Back Office screen: type the name + reason.
  await signInUi(page, "admin@contoh.id");
  await page.goto("/app/admin");
  await page.locator("li").filter({ hasText: SEGARA }).getByRole("button", { name: "Arsipkan" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Alasan (wajib)").fill("Uji arsip: pura tidak lagi dikelola lewat aplikasi");
  const confirm = dlg.getByRole("button", { name: "Arsipkan pura" });
  await expect(confirm).toBeDisabled();
  await dlg.getByLabel(/Ketik nama/).fill(SEGARA);
  await confirm.click();
  await expect(page.getByText("Diarsipkan", { exact: true }).first()).toBeVisible();

  // Public: gone from the list and search; its page says "tidak tersedia" without any data.
  expect((await publicData(page.request)).temples.some((t) => t.id === segara.id)).toBe(false);
  await page.goto(`/pura/${segara.slug}`);
  await expect(page.getByText("Pura tidak tersedia")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Segara");
  await expect(page.locator("main")).not.toContainText("Rp");

  // No new punia (umat) and no new transactions (pengurus), but data stays readable.
  const umat = await as("ayu@contoh.id");
  const punia = await command(umat, "submitPunia", { templeId: segara.id, amount: 21_000, transferDate: today(), evidence: receiptDataUrl(4201), anonymous: false, purpose: "umum" });
  expect(punia.ok).toBe(false);
  expect((await command(made, "setActiveTemple", { templeId: segara.id })).ok).toBe(true);
  const st = (await (await made.get("/api/state")).json()).state;
  expect(st.data.transactions.length).toBeGreaterThan(0);
  const tx = await command(made, "addTransaction", {
    input: { type: "expense", amount: 10_000, date: today(), description: "Uji saat diarsipkan", accountId: st.data.accounts[0].id, categoryId: st.data.categories.find((c: { type: string }) => c.type === "expense")?.id, status: "confirmed" },
    key: "arsip-uji-0001",
  });
  expect(tx.ok).toBe(false);
  expect(tx.error).toMatch(/diarsipkan/);
  // The database refuses as well.
  await expect(db`insert into donations (id, temple_id, donor_name, amount, date, privacy, status, channel) values ('dn_arsip_uji', ${segara.id}, 'Uji', 1000, ${today()}, 'public', 'pending', 'cash')`).rejects.toThrow(/diarsipkan/);
  await db.end();
  // Reports keep working for the archived temple.
  await signInUi(page, "made@contoh.id");
  await command(page.request, "setActiveTemple", { templeId: segara.id });
  await page.goto("/app/laporan");
  await expect(page.getByText("Pura ini diarsipkan — hanya bisa dilihat")).toBeVisible();
  await expect(page.getByRole("button", { name: "CSV" })).toBeEnabled();

  // Reactivate (Admin Utama, with reason) → public again. Everything is in the Log.
  expect((await command(admin, "unarchiveTemple", { id: segara.id, confirmName: SEGARA, reason: "Uji selesai, aktif lagi" })).ok).toBe(true);
  expect((await publicData(page.request)).temples.some((t) => t.id === segara.id)).toBe(true);
  const log = await (await admin.get("/api/admin/log")).text();
  expect(log).toContain("Mengarsipkan pura");
  expect(log).toContain("Mengaktifkan kembali pura");
  expect(log).toContain("Uji arsip: pura tidak lagi dikelola");
});

test("pura kosong: hapus permanen berhasil, peran pengurusnya dicabut, tercatat di Log", async () => {
  const admin = await as("admin@contoh.id");
  const banjarA = (await adminData(admin)).banjars.find((b) => b.name === "CONTOH Banjar Adat Kertha Sari")!;
  const created = await command<{ id: string }>(admin, "adminSaveTemple", { name: "CONTOH Pura Uji Hapus", banjarIds: [banjarA.id] });
  expect(created.ok, created.error).toBe(true);
  const id = created.value.id;
  expect((await command(admin, "adminAddStaff", { email: "pengurus.uji.hapus@contoh.id", name: "Pengurus Uji Hapus (contoh)", kind: "pengurus", templeId: id })).ok).toBe(true);
  expect((await adminData(admin)).memberships.some((m) => m.templeId === id)).toBe(true);

  const r = await command(admin, "deleteTemple", { id, confirmName: "contoh pura uji hapus", reason: "Salah input, pura dobel" });
  expect(r.ok, r.error).toBe(true);
  const after = await adminData(admin);
  expect(after.temples.some((t) => t.id === id)).toBe(false);
  expect(after.memberships.some((m) => m.templeId === id)).toBe(false);
  const log = await (await admin.get("/api/admin/log")).text();
  expect(log).toContain("Menghapus pura permanen");
  expect(log).toContain("Pengurus Uji Hapus (contoh)");
  // The person keeps their account but has no temple any more.
  const p = await as("pengurus.uji.hapus@contoh.id");
  expect((await (await p.get("/api/state")).json()).state.access.isStaff).toBe(false);
});

test("banjar yang masih mengempon pura tidak bisa dihapus; banjar kosong bisa", async () => {
  const admin = await as("admin@contoh.id");
  const b = (await adminData(admin)).banjars.find((x) => x.name === BANJAR_B)!;
  const r = await command(admin, "deleteBanjar", { id: b.id, confirmName: BANJAR_B, reason: "uji hapus banjar" });
  expect(r.ok).toBe(false);
  expect(r.error).toMatch(/masih mengempon 2 pura/);
  const db = sql();
  await expect(db`delete from banjars where id = ${b.id}`).rejects.toThrow(/tidak boleh dihapus/);
  await db.end();

  const empty = await command<{ id: string }>(admin, "saveBanjar", { name: "CONTOH Banjar Uji Kosong" });
  expect(empty.ok).toBe(true);
  expect((await command(admin, "deleteBanjar", { id: empty.value.id, confirmName: "CONTOH Banjar Uji Kosong", reason: "Banjar dobel" })).ok).toBe(true);
  expect((await adminData(admin)).banjars.some((x) => x.id === empty.value.id)).toBe(false);
  expect(await (await admin.get("/api/admin/log")).text()).toContain("Menghapus banjar permanen");
});

test("arsip banjar: pura yang diempon dua banjar tetap berjalan dan tetap bisa dibuka banjar lainnya", async ({ page }) => {
  const admin = await as("admin@contoh.id");
  const data = await adminData(admin);
  const b = data.banjars.find((x) => x.name === BANJAR_B)!;
  const segara = data.temples.find((t) => t.name === SEGARA)!;
  expect((await command(admin, "archiveBanjar", { id: b.id, confirmName: BANJAR_B, reason: "Uji arsip banjar" })).ok).toBe(true);

  // The temple stays public; the archived banjar is no longer listed as pengempon.
  const pub = await (await page.request.get("/api/public")).json();
  expect(pub.data.temples.some((t: { id: string }) => t.id === segara.id)).toBe(true);
  expect(pub.data.banjars.some((x: { id: string }) => x.id === b.id)).toBe(false);
  // Pengurus Banjar of the OTHER banjar and the Pengurus Pura keep access.
  expect((await command(await as("ketut.banjar@contoh.id"), "setActiveTemple", { templeId: segara.id })).ok).toBe(true);
  expect((await command(await as("made@contoh.id"), "setActiveTemple", { templeId: segara.id })).ok).toBe(true);
  // Pengurus Banjar of the archived banjar lose access until it is reactivated.
  const gede = await as("gede.banjar@contoh.id");
  expect((await command(gede, "setActiveTemple", { templeId: segara.id })).ok).toBe(false);

  expect((await command(admin, "unarchiveBanjar", { id: b.id, confirmName: BANJAR_B, reason: "Uji selesai" })).ok).toBe(true);
  expect((await command(gede, "setActiveTemple", { templeId: segara.id })).ok).toBe(true);
  const log = await (await admin.get("/api/admin/log")).text();
  expect(log).toContain("Mengarsipkan banjar");
  expect(log).toContain("Mengaktifkan kembali banjar");
});
