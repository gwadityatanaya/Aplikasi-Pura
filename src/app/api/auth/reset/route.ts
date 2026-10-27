import { z } from "zod";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { createSession, hashPassword, passwordProblem, rateLimit, sha256 } from "@/server/auth";
import { ApiError, assertSameOrigin, clientIp, json, readJson, route } from "@/server/http";
import { logActivity } from "@/server/log";

export const dynamic = "force-dynamic";

async function findToken(token: string) {
  const [row] = await db
    .select({ t: schema.passwordTokens, u: schema.users })
    .from(schema.passwordTokens)
    .innerJoin(schema.users, eq(schema.users.id, schema.passwordTokens.userId))
    .where(and(eq(schema.passwordTokens.tokenHash, sha256(token)), isNull(schema.passwordTokens.usedAt), gt(schema.passwordTokens.expiresAt, new Date())));
  return row;
}

export const GET = route(async (req: Request) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const row = token ? await findToken(token) : undefined;
  if (!row || row.u.status !== "active") return json({ ok: true, valid: false });
  return json({ ok: true, valid: true, purpose: row.t.purpose, name: row.u.name, email: row.u.email });
});

/** Sets a new password from a one-time link (account activation or password reset). */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await rateLimit(`reset:${clientIp(req) ?? "unknown"}`, 10, 30);
  const { token, password } = z.object({ token: z.string().min(10).max(200), password: z.string().max(200) }).parse(await readJson(req));
  const row = await findToken(token);
  if (!row || row.u.status !== "active") throw new ApiError(400, "Tautan tidak valid, sudah dipakai, atau kedaluwarsa. Minta tautan baru ke Admin Utama.");
  const problem = passwordProblem(password, row.u.email);
  if (problem) throw new ApiError(400, problem);
  const hash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.update(schema.passwordTokens).set({ usedAt: new Date() }).where(eq(schema.passwordTokens.tokenHash, row.t.tokenHash));
    await tx.update(schema.users).set({ passwordHash: hash, resetRequestedAt: null }).where(eq(schema.users.id, row.u.id));
    await tx.update(schema.memberships).set({ status: "active" }).where(and(eq(schema.memberships.userId, row.u.id), eq(schema.memberships.status, "invited")));
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, row.u.id));
    await logActivity({ actor: { id: row.u.id, name: row.u.name, email: row.u.email }, action: row.t.purpose === "activation" ? "Mengaktifkan akun" : "Mengatur ulang kata sandi", entity: "session", entityId: row.u.id, detail: "Melalui tautan sekali pakai", req }, tx);
  });
  const [first] = await db.select().from(schema.memberships).where(and(eq(schema.memberships.userId, row.u.id), eq(schema.memberships.status, "active"))).limit(1);
  await createSession(row.u.id, req, first?.templeId ?? null);
  return json({ ok: true });
});
