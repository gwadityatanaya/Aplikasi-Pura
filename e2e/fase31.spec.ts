import { expect, request as pw, test } from "@playwright/test";
import { command, publicData, receiptDataUrl, signInApi, signInUi as signInUiAs, today } from "./helpers";

// Phase 3.1 checks. Runs before punia.spec.ts and uses its own amounts so the two do not collide.
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3100";
async function as(email: string) {
  const ctx = await pw.newContext({ baseURL: BASE });
  await signInApi(ctx, email);
  return ctx;
}

test("pura tanpa email dan tanpa pengurus tampil benar, dan punianya disahkan Pengurus Banjar", async ({ page }) => {
  const pub = await publicData(page.request);
  const t = pub.temples.find((x) => x.name.includes("Melanting"))! as unknown as Record<string, unknown> & { id: string; slug: string };
  expect(t).toBeTruthy();
  expect("email" in t).toBe(false);
  expect(t.hasPengurus).toBe(false);
  expect(t.acceptsPunia).toBe(true);
  await page.goto(`/pura/${t.slug}`);
  await expect(page.getByText("Pengurus pura belum terdaftar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kontak" })).toHaveCount(0);

  const umat = await as("kadek@contoh.id");
  const sent = await command<{ id: string }>(umat, "submitPunia", { templeId: t.id, amount: 31_000, transferDate: today(), evidence: receiptDataUrl(3101), anonymous: false, purpose: "umum" });
  expect(sent.ok, sent.error).toBe(true);
  const banjar = await as("ketut.banjar@contoh.id");
  expect((await command(banjar, "setActiveTemple", { templeId: t.id })).ok).toBe(true);
  const v = await command<{ verified: number }>(banjar, "verifyPunia", { ids: [sent.value.id] });
  expect(v.ok, v.error).toBe(true);
});

test("Admin Utama mendaftarkan pura hanya dengan nama dan banjar", async () => {
  const admin = await as("admin@contoh.id");
  const state = await (await admin.get("/api/admin/users")).json();
  const banjarId = state.banjars[0].id as string;
  const r = await command<{ id: string }>(admin, "adminSaveTemple", { name: "CONTOH Pura Tanpa Data", banjarIds: [banjarId] });
  expect(r.ok, r.error).toBe(true);
  const noBanjar = await command(admin, "adminSaveTemple", { name: "CONTOH Pura Tanpa Banjar", banjarIds: [] });
  expect(noBanjar.ok).toBe(false);
});

test("input manual TAMPIL dan ANONIM: nama asli & nama pencatat tidak bocor ke publik", async ({ page }) => {
  const made = await as("made@contoh.id");
  const pub0 = await publicData(made);
  const dalem = pub0.temples.find((t) => t.name.includes("Dalem Kahyangan"))!;
  await command(made, "setActiveTemple", { templeId: dalem.id });
  const base = { transferDate: today(), purpose: "umum", channel: "whatsapp" };
  const shown = await command<{ verified: boolean }>(made, "addManualPunia", { ...base, donorName: "Pak Tampil Terbuka", amount: 31_100, anonymous: false });
  expect(shown.ok, shown.error).toBe(true);
  expect(shown.value.verified).toBe(true);
  const hidden = await command<{ verified: boolean }>(made, "addManualPunia", { ...base, donorName: "Bu Rahasia Manual", amount: 31_200, anonymous: true, channel: "tunai" });
  expect(hidden.ok, hidden.error).toBe(true);

  const raw = await (await page.request.get("/api/public")).text();
  expect(raw).toContain("Pak Tampil Terbuka");
  expect(raw).not.toContain("Rahasia Manual");
  expect(raw).not.toContain("Suarjana"); // the pengurus who typed it in
  expect(raw).not.toContain("inputBy");
  await page.goto(`/pura/${dalem.slug}`);
  await expect(page.getByText("Rahasia Manual")).toHaveCount(0);
  await expect(page.getByText(/dicatat oleh/i)).toHaveCount(0);

  // Staff see "dicatat oleh"; a Pemeriksa sees "Anonim" instead of the real name.
  const st = (await (await made.get("/api/state")).json()).state.data.donations as { donorName: string; inputByName?: string; amount: number }[];
  expect(st.find((d) => d.amount === 31_200)).toMatchObject({ donorName: "Bu Rahasia Manual", inputByName: "I Made Suarjana" });
  const oka = await as("oka.pemeriksa@contoh.id");
  const so = (await (await oka.get("/api/state")).json()).state.data.donations as { donorName: string; amount: number }[];
  expect(so.find((d) => d.amount === 31_200)?.donorName).toBe("Anonim");

  // Log Aktivitas keeps who typed it in, but never the donor's name.
  const audit = JSON.stringify((await (await made.get("/api/state")).json()).state.data.audit);
  expect(audit).toContain("Dicatat oleh I Made Suarjana");
  expect(audit).not.toContain("Rahasia Manual");
});

test("laporan punia versi umum: nama anonim dan pencatat tidak ada di isi maupun nama berkas", async ({ page }) => {
  await signInUiAs(page, "komang@contoh.id");
  await page.goto("/app/laporan");
  await page.locator("#r-type").selectOption("punia");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "CSV" }).click()]);
  const name = dl.suggestedFilename();
  const body = await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
  expect(body).toContain("Anonim");
  expect(body).toContain("Pak Tampil Terbuka");
  for (const s of ["Rahasia Manual", "Suarjana", "Dewi"]) {
    expect(body).not.toContain(s);
    expect(name).not.toContain(s.toLowerCase());
  }
  // Versi lengkap is for pengurus: real name and who typed it in.
  await page.locator("#r-type").selectOption("punia_lengkap");
  const [dl2] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "CSV" }).click()]);
  const full = await (await dl2.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
  expect(full).toContain("Bu Rahasia Manual");
  expect(full).toContain("I Made Suarjana");
  expect(dl2.suggestedFilename()).toContain("internal");
});

test("koreksi punia: catatan tidak diubah, entri koreksi dibuat, punia tidak lagi dihitung", async ({ page }) => {
  const komang = await as("komang@contoh.id");
  const st = (await (await komang.get("/api/state")).json()).state.data.donations as { id: string; amount: number; transactionId: string }[];
  const d = st.find((x) => x.amount === 31_100)!;
  const r = await command<{ number: string }>(komang, "correctPunia", { id: d.id, reason: "Nominal salah ketik" });
  expect(r.ok, r.error).toBe(true);
  expect(r.value.number).toMatch(/TRX-/);
  expect((await command(komang, "correctPunia", { id: d.id, reason: "Coba lagi" })).ok).toBe(false);
  const raw = await (await page.request.get("/api/public")).text();
  expect(raw).not.toContain("Pak Tampil Terbuka");
  const after = (await (await komang.get("/api/state")).json()).state.data as { donations: { id: string; amount: number; status: string; correctedAt?: string }[]; transactions: { reversalOf?: string; id: string }[] };
  const same = after.donations.find((x) => x.id === d.id)!;
  expect(same.amount).toBe(31_100);
  expect(same.status).toBe("verified");
  expect(same.correctedAt).toBeTruthy();
  expect(after.transactions.some((t) => t.reversalOf === d.transactionId)).toBe(true);
});
