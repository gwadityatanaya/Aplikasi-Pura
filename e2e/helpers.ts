import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { crc32, deflateSync } from "zlib";
import postgres from "postgres";

const BASE = "http://localhost:3100";

/** The tests sign in many times in a row; clear the sign-in rate limit between them. */
export async function clearRateLimits() {
  const sql = postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
  await sql`delete from rate_limits`;
  await sql.end();
}

/** Requests an email sign-in link. Without SMTP (development) the link is returned directly. */
export async function signInLink(request: APIRequestContext, email: string) {
  await clearRateLimits();
  const r = await request.post("/api/auth/email-link", { data: { email }, headers: { origin: BASE } });
  const j = await r.json();
  expect(j.ok, j.error).toBe(true);
  expect(j.devLink).toBeTruthy();
  return j.devLink as string;
}

/** Signs in through the real screen: open the link, press "Masuk sekarang". */
export async function signInUi(page: Page, email: string) {
  await page.goto(await signInLink(page.request, email));
  await page.getByRole("button", { name: /Masuk sekarang/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/masuk"));
}

/** Signs in for API calls (shares cookies with the page's browser context). */
export async function signInApi(request: APIRequestContext, email: string) {
  const token = new URL(await signInLink(request, email)).searchParams.get("token");
  const r = await request.post("/api/auth/email-link/verify", { data: { token }, headers: { origin: BASE } });
  expect((await r.json()).ok).toBe(true);
}

export async function command<T = unknown>(request: APIRequestContext, name: string, payload: unknown = {}) {
  const r = await request.post("/api/commands", { data: { name, payload }, headers: { origin: BASE } });
  return (await r.json()) as { ok: boolean; error?: string; value: T };
}

export async function publicData(request: APIRequestContext) {
  const r = await request.get("/api/public");
  return (await r.json()).data as { temples: { id: string; slug: string; name: string }[]; donations: { templeId: string; donorName: string; amount: number }[] };
}

export async function templeId(request: APIRequestContext, name: string) {
  const t = (await publicData(request)).temples.find((x) => x.name === name);
  expect(t, `pura ${name}`).toBeTruthy();
  return t!;
}

/** A valid PNG; each seed gives different bytes, so it counts as a different proof. */
export function receipt(seed: number) {
  const w = 16;
  const h = 16;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([(seed * 37) % 256, (seed * 91 + x) % 256, (seed * 13 + y) % 256], y * (w * 3 + 1) + 1 + x * 3);
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
export const receiptDataUrl = (seed: number) => `data:image/png;base64,${receipt(seed).toString("base64")}`;

export const today = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
