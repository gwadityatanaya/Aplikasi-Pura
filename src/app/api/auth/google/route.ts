import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { newToken, originOf, safeNext } from "@/server/auth";

export const dynamic = "force-dynamic";

/** Starts "Masuk dengan Google" (OAuth 2.0 authorization code flow with PKCE). */
export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const origin = originOf(req);
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) return NextResponse.redirect(`${origin}/masuk?error=google-belum-diatur`);
  const state = newToken();
  const verifier = newToken();
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  cookies().set("pura_oauth", JSON.stringify({ state, verifier, next }), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google", maxAge: 600,
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return NextResponse.redirect(url.toString());
}
