import { z } from "zod";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { rateLimit, sha256, signInWithEmail } from "@/server/auth";
import { ApiError, assertSameOrigin, clientIp, json, readJson, route } from "@/server/http";
import { logActivity } from "@/server/log";

export const dynamic = "force-dynamic";

/**
 * Uses a one-time sign-in link. This is a POST from the /masuk/tautan page (not the GET link itself),
 * so email scanners that open links automatically cannot use up the token.
 */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await rateLimit(`linkverify:${clientIp(req) ?? "unknown"}`, 20, 15);
  const { token } = z.object({ token: z.string().min(20).max(200) }).parse(await readJson(req));
  const used = await db
    .update(schema.passwordTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.passwordTokens.tokenHash, sha256(token)), eq(schema.passwordTokens.purpose, "login"), isNull(schema.passwordTokens.usedAt), gt(schema.passwordTokens.expiresAt, new Date())))
    .returning();
  const row = used[0];
  if (!row?.email) {
    await logActivity({ actor: { id: null, name: "Tidak dikenal" }, action: "Tautan masuk tidak valid", entity: "session", detail: "Tautan sudah dipakai, kedaluwarsa, atau salah", req });
    throw new ApiError(400, "Tautan ini sudah dipakai atau kedaluwarsa. Minta tautan baru.");
  }
  const r = await signInWithEmail(req, { email: row.email, method: "email" });
  return json({ ok: true, next: r.isStaff ? "/app" : "/umat" });
});
