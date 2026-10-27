import "server-only";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "").trim() || null;
}

export function userAgent(req: Request) {
  return req.headers.get("user-agent")?.slice(0, 300) ?? null;
}

/** Blocks cross-site form/fetch posts (CSRF). Cookies are also SameSite=Lax. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new ApiError(403, "Permintaan ditolak (asal tidak dikenal).");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(403, "Permintaan ditolak.");
  }
}

export async function readJson<T = unknown>(req: Request, maxBytes = 3_500_000): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "Data terlalu besar. Perkecil ukuran foto.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(400, "Format data tidak valid.");
  }
}

/** Wraps a route handler: converts thrown errors into friendly JSON responses. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return json({ ok: false, error: e.message }, e.status);
      if (e && typeof e === "object" && "issues" in e) return json({ ok: false, error: "Data yang dikirim belum lengkap atau tidak valid." }, 400);
      const msg = e instanceof Error ? e.message : String(e);
      // Messages raised by our database guards are safe to show.
      if (/tidak boleh|Admin Utama/.test(msg)) return json({ ok: false, error: msg.replace(/^.*?: /, "") }, 409);
      console.error("[api]", e);
      return json({ ok: false, error: "Terjadi kesalahan di server. Coba lagi sebentar lagi." }, 500);
    }
  };
}

export function todayInAppTz() {
  const tz = process.env.APP_TIMEZONE || "Asia/Makassar";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
