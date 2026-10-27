import { expect, request as pw, test } from "@playwright/test";
import postgres from "postgres";
import { command, publicData, receipt, signInApi, signInUi } from "./helpers";

// Phase 3.2 tahap 6 — floating Pusat bantuan for signed-in people, Admin Utama inbox, replies,
// automatic context (no financial data), rate limit, attachments removed N days after "Selesai".
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3100";
type Ticket = { id: string; category: string; status: string; context: Record<string, string>; attachment?: string; attachmentRemovedAt?: string; unreadByUser: boolean; replies: { authorName: string; message: string }[] };
async function as(email: string) {
  const ctx = await pw.newContext({ baseURL: BASE });
  await signInApi(ctx, email);
  return ctx;
}
const sql = () => postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
let staffTicket = "";

test("tombol bantuan: aman di HP (di atas navigasi & tombol Berpunia, tidak melebarkan halaman), hanya untuk yang sudah masuk", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const slug = (await publicData(page.request)).temples[0].slug;
  await page.goto(`/pura/${slug}`);
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Bantuan/ })).toHaveCount(0); // not signed in

  await signInUi(page, "made@contoh.id");
  for (const [url, bar] of [["/app", 'nav[aria-label="Navigasi bawah"]'], [`/pura/${slug}`, "text=Berpunia"]] as const) {
    await page.goto(url);
    const btn = page.getByRole("button", { name: /^Bantuan/ });
    await expect(btn).toBeVisible();
    const b = (await btn.boundingBox())!;
    const n = (await page.locator(bar).last().boundingBox())!;
    expect(b.y + b.height, `${url}: tombol bantuan tidak menutupi bar bawah`).toBeLessThanOrEqual(n.y + 1);
    expect(b.x + b.width).toBeLessThanOrEqual(360);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), url).toBeLessThanOrEqual(360);
  }
});

test("pengurus mengirim laporan masalah + gambar; konteks terisi otomatis tanpa data keuangan", async ({ page }) => {
  await signInUi(page, "made@contoh.id");
  const dalem = (await publicData(page.request)).temples.find((t) => t.name.endsWith("Pura Dalem Kahyangan"))!;
  await command(page.request, "setActiveTemple", { templeId: dalem.id });
  await page.goto("/app/laporan");
  await page.getByRole("button", { name: /^Bantuan/ }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByText("Jangan menulis kata sandi, PIN, kode OTP, atau kode rahasia apa pun")).toBeVisible();
  await dlg.getByLabel("Jenis pesan").selectOption("masalah");
  await dlg.getByLabel("Pesan", { exact: true }).fill("Tombol Excel tidak bisa ditekan di HP saya.");
  await dlg.getByLabel("Lampiran gambar").setInputFiles({ name: "layar.png", mimeType: "image/png", buffer: receipt(601) });
  await expect(dlg.getByAltText("Gambar lampiran")).toBeVisible();
  await dlg.getByRole("button", { name: "Kirim pesan" }).click();
  await expect(page.getByText("Pesan terkirim")).toBeVisible();

  const t = ((await (await page.request.get("/api/bantuan")).json()).tickets as Ticket[])[0];
  staffTicket = t.id;
  expect(t.category).toBe("masalah");
  expect(t.status).toBe("baru");
  expect(t.context.page).toBe("/app/laporan");
  expect(t.context.role).toBe("Pengurus Pura");
  expect(t.context.temple).toBe(dalem.name);
  expect(t.context.device).toBeTruthy();
  expect(t.context.browser).toMatch(/Chrome|Firefox|Safari|Edge/);
  expect(Object.keys(t.context).sort()).toEqual(["browser", "device", "page", "role", "screen", "temple"]);
  expect(JSON.stringify(t.context)).not.toMatch(/Rp|\d{3}\.\d{3}/);
  expect((await page.request.get(t.attachment!)).status()).toBe(200);
  // The query part of the page (e.g. a punia id) is never stored.
  const q = await command<{ id: string }>(page.request, "submitHelp", { category: "cara_pakai", message: "Bagaimana mengoreksi punia?", page: "/app/punia?id=dn_rahasia" });
  const t2 = ((await (await page.request.get("/api/bantuan")).json()).tickets as Ticket[]).find((x) => x.id === q.value.id)!;
  expect(t2.context.page).toBe("/app/punia");
  // Someone else cannot open the attachment.
  expect((await (await as("komang@contoh.id")).get(t.attachment!)).status()).toBe(404);
});

test("umat dari halaman pura: pura terkait ikut tercatat; batas pesan per jam", async ({ page }) => {
  await signInUi(page, "ayu@contoh.id");
  const temple = (await publicData(page.request)).temples.find((t) => t.name.endsWith("Pura Segara Bersama"))!;
  await page.goto(`/pura/${temple.slug}`);
  await page.getByRole("button", { name: /^Bantuan/ }).click();
  await page.getByLabel("Jenis pesan").selectOption("penyalahgunaan");
  await page.getByLabel("Pesan", { exact: true }).fill("Ada yang meminta transfer ke rekening pribadi atas nama pura ini.");
  await page.getByRole("button", { name: "Kirim pesan" }).click();
  await expect(page.getByText("Pesan terkirim")).toBeVisible();
  const t = ((await (await page.request.get("/api/bantuan")).json()).tickets as Ticket[])[0];
  expect(t.context).toMatchObject({ page: `/pura/${temple.slug}`, role: "Umat", temple: temple.name });

  // 5 messages per hour per person: this was the 1st.
  for (let i = 2; i <= 5; i++) expect((await command(page.request, "submitHelp", { category: "lainnya", message: `Pesan uji nomor ${i} dari umat`, page: "/umat" })).ok).toBe(true);
  const sixth = await command(page.request, "submitHelp", { category: "lainnya", message: "Pesan uji nomor 6 dari umat", page: "/umat" });
  expect(sixth.ok).toBe(false);
  expect(sixth.error).toMatch(/5 pesan dalam satu jam/);
});

test("Admin Utama: kotak masuk dengan lencana belum dibaca, membalas, mengubah status; tercatat di Log", async ({ page }) => {
  await signInUi(page, "admin@contoh.id");
  const st = (await (await page.request.get("/api/state")).json()).state;
  expect(st.access.help.inbox).toBeGreaterThanOrEqual(7);
  await page.goto("/app/admin?tab=bantuan");
  await expect(page.getByRole("tab", { name: /^Bantuan \(\d+\)$/ })).toBeVisible();
  const card = page.locator("li").filter({ hasText: "Tombol Excel tidak bisa ditekan" });
  await expect(card.getByText("Belum dibaca")).toBeVisible();
  await card.getByRole("button", { name: /Laporkan masalah/ }).click();
  await expect(card.getByText("/app/laporan")).toBeVisible();
  await expect(card.getByAltText("Gambar lampiran")).toBeVisible();
  await expect(card.getByText("Belum dibaca")).toHaveCount(0);
  await card.getByLabel("Balas").fill("Terima kasih. Sudah kami perbaiki, silakan coba lagi.");
  await card.getByRole("button", { name: "Kirim balasan" }).click();
  await expect(page.getByText("Balasan terkirim")).toBeVisible();
  await expect(card.getByText("Diproses", { exact: true }).first()).toBeVisible(); // a reply moves "Baru" to "Diproses"
  await card.getByRole("button", { name: "Tandai Selesai" }).click();
  await expect(card.getByText("Selesai", { exact: true }).first()).toBeVisible();
  const log = await (await page.request.get("/api/admin/log")).text();
  for (const s of ["Mengirim pesan bantuan", "Membalas pesan bantuan", "Mengubah status pesan bantuan"]) expect(log).toContain(s);
  // Only Admin Utama can change the status or read the inbox.
  const made = await as("made@contoh.id");
  expect((await command(made, "setHelpStatus", { ticketId: staffTicket, status: "baru" })).ok).toBe(false);
  expect((await made.get("/api/admin/bantuan")).status()).toBe(403);
});

test("pengguna melihat balasan di halaman Bantuan (lencana baru), lalu lampiran terhapus otomatis setelah N hari", async ({ page }) => {
  await signInUi(page, "made@contoh.id");
  expect((await (await page.request.get("/api/state")).json()).state.access.help.unread).toBe(1);
  await page.goto("/app");
  await expect(page.getByRole("button", { name: "Bantuan (1 balasan baru)" })).toBeVisible();
  await page.goto("/bantuan");
  const card = page.locator("li").filter({ hasText: "Tombol Excel tidak bisa ditekan" });
  await expect(card.getByText("Balasan baru")).toBeVisible();
  await card.getByRole("button", { name: /Laporkan masalah/ }).click();
  await expect(card.getByText("Sudah kami perbaiki")).toBeVisible();
  await expect(card.getByText(/^Admin Utama ·/)).toBeVisible();
  await expect.poll(async () => (await (await page.request.get("/api/state")).json()).state.access.help.unread).toBe(0);

  // Finished more than 30 days ago → the image is deleted, the message itself stays.
  const db = sql();
  const [{ attachment_id: file }] = await db`select attachment_id from help_tickets where id = ${staffTicket}`;
  expect(file).toBeTruthy();
  await db`update help_tickets set closed_at = now() - interval '31 days' where id = ${staffTicket}`;
  const admin = await as("admin@contoh.id");
  const tickets = (await (await admin.get("/api/admin/bantuan")).json()).tickets as Ticket[];
  const t = tickets.find((x) => x.id === staffTicket)!;
  expect(t.attachment).toBeUndefined();
  expect(t.attachmentRemovedAt).toBeTruthy();
  expect((await db`select count(*)::int as n from attachments where id = ${file}`)[0].n).toBe(0);
  expect((await admin.get(`/api/bantuan/lampiran/${staffTicket}`)).status()).toBe(410);
  await db.end();
});
