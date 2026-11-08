import { expect, request as pw, test } from "@playwright/test";
import postgres from "postgres";
import { command, publicData, receiptDataUrl, signInApi, signInUi, today } from "./helpers";

// Phase 3.3 tahap 2 — campaign form: only the title is required; "Kegiatan baru" saved in the
// same database transaction; closing early with a public reason that can never be edited.
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3100";
async function as(email: string, temple?: string) {
  const ctx = await pw.newContext({ baseURL: BASE });
  await signInApi(ctx, email);
  if (temple) expect((await command(ctx, "setActiveTemple", { templeId: temple })).ok).toBe(true);
  return ctx;
}
type Camp = { id: string; slug: string; title: string; activityId?: string; status: string; closeReason?: string };
const sql = () => postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
const daysAgo = (n: number) => new Date(Date.now() + 8 * 3600_000 - n * 86400_000).toISOString().slice(0, 10);
let dalem = "";
let minimal: Camp;

async function openWizard(page: import("@playwright/test").Page) {
  await signInUi(page, "made@contoh.id");
  dalem = (await publicData(page.request)).temples.find((t) => t.name.endsWith("Pura Dalem Kahyangan"))!.id;
  await command(page.request, "setActiveTemple", { templeId: dalem });
  await page.goto("/app/campaign/baru");
}
async function finish(page: import("@playwright/test").Page) {
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: "Terbitkan" }).click();
  await page.getByRole("button", { name: "Ya, terbitkan" }).click();
  await expect(page.getByText("Campaign sudah tayang!")).toBeVisible();
}

test("hanya judul yang wajib; tanpa target, halaman publik tidak menampilkan bilah kemajuan atau persentase", async ({ page }) => {
  await openWizard(page);
  await page.getByLabel("Judul campaign").fill("Punia Sukarela Tanpa Target");
  await finish(page);
  const made = await as("made@contoh.id", dalem);
  minimal = ((await (await made.get("/api/state")).json()).state.data.campaigns as Camp[]).find((c) => c.title === "Punia Sukarela Tanpa Target")!;
  await page.goto(`/donasi/${minimal.slug}`);
  await expect(page.getByRole("heading", { name: "Punia Sukarela Tanpa Target" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByText("dari target")).toHaveCount(0);
  await expect(page.getByText("tercapai")).toHaveCount(0);
  await expect(page.getByText("Dana digunakan untuk")).toHaveCount(0);
  await expect(page.getByText("Tanpa batas")).toBeVisible();
  // The list card and the temple page stay tidy too.
  await page.goto("/donasi");
  const card = page.getByRole("link").filter({ hasText: "Punia Sukarela Tanpa Target" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("progressbar")).toHaveCount(0);
  await expect(card).not.toContainText("%");
});

test("\"Kegiatan baru\" di form penggalangan tersimpan dan tertaut; jika gagal tidak ada kegiatan setengah jadi", async ({ page }) => {
  await openWizard(page);
  await page.getByLabel("Judul campaign").fill("Punia Melasti 2026");
  await page.getByLabel("Kegiatan terkait").selectOption({ label: "+ Kegiatan baru…" });
  await page.locator("#na-name").fill("Melasti 2026");
  await page.locator("#na-start").fill(today());
  await page.locator("#na-end").fill(today());
  await finish(page);
  const made = await as("made@contoh.id", dalem);
  const st = (await (await made.get("/api/state")).json()).state.data;
  const act = (st.activities as { id: string; name: string }[]).find((a) => a.name === "Melasti 2026")!;
  expect(act).toBeTruthy();
  expect((st.campaigns as Camp[]).find((c) => c.title === "Punia Melasti 2026")!.activityId).toBe(act.id);

  // Saving fails (unknown account) → the new kegiatan is rolled back as well.
  const bad = await command(made, "saveCampaign", {
    input: { title: "Gagal Simpan", cover: "emerald", startDate: today(), accountId: "acc_tidak_ada", manualVerification: true, showDonorList: true, defaultPrivacy: "public" },
    status: "active",
    newActivity: { name: "Kegiatan Setengah Jadi", startDate: today(), endDate: today(), fundType: "general", status: "planned", color: "#087F6D" },
  });
  expect(bad.ok).toBe(false);
  const after = (await (await made.get("/api/state")).json()).state.data.activities as { name: string }[];
  expect(after.some((a) => a.name === "Kegiatan Setengah Jadi")).toBe(false);
});

test("tutup penggalangan: alasan wajib & publik, tidak bisa diedit, tidak menerima punia baru; koreksi lewat catatan", async ({ page }) => {
  const made = await as("made@contoh.id", dalem);
  expect((await command(made, "closeCampaign", { id: minimal.id, reason: "" })).ok).toBe(false);
  const personal = await command(made, "closeCampaign", { id: minimal.id, reason: "Hubungi 081234567890 untuk info" });
  expect(personal.ok).toBe(false);
  expect(personal.error).toMatch(/data pribadi/);
  expect((await command(await as("oka.pemeriksa@contoh.id", dalem), "closeCampaign", { id: minimal.id, reason: "Pemeriksa mencoba menutup" })).ok).toBe(false);

  await signInUi(page, "made@contoh.id");
  await command(page.request, "setActiveTemple", { templeId: dalem });
  await page.goto(`/app/campaign/${minimal.id}`);
  await page.getByRole("button", { name: "Tutup penggalangan" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByText(/Jangan menulis nama orang/)).toBeVisible();
  await dlg.getByLabel(/Alasan penutupan/).fill("Dana upakara sudah mencukupi");
  await dlg.getByRole("button", { name: "Tutup penggalangan" }).click();
  await expect(page.getByText("Penggalangan ditutup")).toBeVisible();

  // Public: still listed, marked Ditutup with date and reason; no punia button.
  await page.goto(`/donasi/${minimal.slug}`);
  const notice = page.getByRole("status").filter({ hasText: "ditutup" });
  await expect(notice).toContainText("Dana upakara sudah mencukupi");
  await expect(page.getByText("Ditutup").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /unggah bukti|Berpunia/ })).toHaveCount(0);
  const slug = (await publicData(page.request)).temples.find((t) => t.id === dalem)!.slug;
  await page.goto(`/pura/${slug}`);
  await expect(page.getByRole("link").filter({ hasText: "Punia Sukarela Tanpa Target" })).toContainText("Ditutup");

  // No new punia (umat, public form, manual); the reason cannot be edited, not even in the database.
  const umat = await as("ayu@contoh.id");
  const p = await command(umat, "submitPunia", { templeId: dalem, campaignId: minimal.id, amount: 25_000, transferDate: today(), evidence: receiptDataUrl(5101), anonymous: false, purpose: "umum" });
  expect(p.ok).toBe(false);
  expect(p.error).toMatch(/ditutup atau berakhir/);
  expect((await command(made, "setCampaignStatus", { id: minimal.id, status: "active" })).ok).toBe(false);
  const db = sql();
  await expect(db`update campaigns set close_reason = 'Diubah diam-diam' where id = ${minimal.id}`).rejects.toThrow(/tidak boleh diubah/);
  await expect(db`update campaigns set close_notes = '[]'::jsonb where id = ${minimal.id}`).resolves.toBeTruthy(); // empty → empty is no change
  await db.end();

  // Correction as a separate, public note.
  expect((await command(made, "addCampaignCloseNote", { id: minimal.id, text: "Sisa dana dipakai untuk perbaikan bale kulkul" })).ok).toBe(true);
  await page.goto(`/donasi/${minimal.slug}`);
  await expect(page.getByText(/Catatan tambahan .*: Sisa dana dipakai untuk perbaikan bale kulkul/)).toBeVisible();
  const db2 = sql();
  await expect(db2`update campaigns set close_notes = '[]'::jsonb where id = ${minimal.id}`).rejects.toThrow(/hanya boleh ditambah/);
  await db2.end();
  const audit = JSON.stringify((await (await made.get("/api/state")).json()).state.data.audit);
  expect(audit).toContain("Menutup penggalangan dana");
  expect(audit).toContain("Menambah catatan penutupan penggalangan");
});

test("penggalangan yang lewat tanggal tampil \"Berakhir\" dan tidak menerima punia baru", async ({ page }) => {
  const made = await as("made@contoh.id", dalem);
  const acc = ((await (await made.get("/api/state")).json()).state.data.accounts as { id: string; type: string }[]).find((a) => a.type === "bank")!;
  const r = await command<Camp>(made, "saveCampaign", {
    input: { title: "Punia Galungan Lalu", cover: "gold", startDate: daysAgo(10), endDate: daysAgo(1), accountId: acc.id, manualVerification: true, showDonorList: true, defaultPrivacy: "public" },
    status: "active",
  });
  expect(r.ok, r.error).toBe(true);
  await page.goto(`/donasi/${r.value.slug}`);
  await expect(page.getByRole("status")).toContainText("berakhir pada");
  await expect(page.getByText("Berakhir").first()).toBeVisible();
  const umat = await as("ayu@contoh.id");
  const p = await command(umat, "submitPunia", { templeId: dalem, campaignId: r.value.id, amount: 15_000, transferDate: today(), evidence: receiptDataUrl(5102), anonymous: false, purpose: "umum" });
  expect(p.ok).toBe(false);
});
