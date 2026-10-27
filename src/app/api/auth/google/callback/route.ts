import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { originOf, safeEqual, safeNext, signInWithEmail } from "@/server/auth";
import { ApiError } from "@/server/http";
import { logActivity } from "@/server/log";

export const dynamic = "force-dynamic";

interface GoogleClaims {
  iss: string;
  aud: string;
  exp: number;
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

/**
 * Google sends the user back here. The id_token comes straight from Google's token endpoint over
 * TLS using our client secret, so its claims are trusted (OpenID Connect Core §3.1.3.7); we still
 * check issuer, audience, expiry and that the email is verified.
 */
export async function GET(req: Request) {
  const origin = originOf(req);
  const params = new URL(req.url).searchParams;
  const fail = (code: string) => NextResponse.redirect(`${origin}/masuk?error=${code}`);
  const raw = cookies().get("pura_oauth")?.value;
  cookies().delete({ name: "pura_oauth", path: "/api/auth/google" });
  if (params.get("error")) return fail("google-dibatalkan");
  let saved: { state: string; verifier: string; next: string | null };
  try {
    saved = JSON.parse(raw ?? "");
  } catch {
    return fail("google-sesi-habis");
  }
  const state = params.get("state") ?? "";
  const code = params.get("code") ?? "";
  if (!code || !state || !safeEqual(state, saved.state)) return fail("google-sesi-habis");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${origin}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: saved.verifier,
    }),
  }).catch(() => null);
  const tokens = res?.ok ? ((await res.json()) as { id_token?: string }) : null;
  if (!tokens?.id_token) return fail("google-gagal");
  let claims: GoogleClaims;
  try {
    claims = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString());
  } catch {
    return fail("google-gagal");
  }
  const validIss = claims.iss === "accounts.google.com" || claims.iss === "https://accounts.google.com";
  if (!validIss || claims.aud !== process.env.GOOGLE_CLIENT_ID || claims.exp * 1000 < Date.now() || !claims.email || claims.email_verified !== true) {
    await logActivity({ actor: { id: null, name: "Tidak dikenal", email: claims.email ?? null }, action: "Login gagal", entity: "session", detail: "Token Google tidak valid atau email belum disahkan", req });
    return fail("google-gagal");
  }
  try {
    const r = await signInWithEmail(req, { email: claims.email, method: "google", googleSub: claims.sub, name: claims.name });
    return NextResponse.redirect(`${origin}${safeNext(saved.next) ?? (r.isStaff ? "/app" : "/umat")}`);
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.redirect(`${origin}/masuk?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
}
