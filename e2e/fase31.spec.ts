import { expect, request as pw, test } from "@playwright/test";
import { command, publicData, receiptDataUrl, signInApi, today } from "./helpers";

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
