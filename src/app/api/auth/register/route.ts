import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { createSession, hashPassword, passwordProblem, rateLimit } from "@/server/auth";
import { ApiError, assertSameOrigin, clientIp, json, readJson, route } from "@/server/http";
import { logActivity } from "@/server/log";
import { uid } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Self-registration — only when ALLOW_REGISTRATION=true. New temples still need Admin Utama approval. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  if (process.env.ALLOW_REGISTRATION !== "true") throw new ApiError(403, "Pendaftaran mandiri sedang ditutup. Hubungi Admin Utama untuk dibuatkan akun.");
  await rateLimit(`register:${clientIp(req) ?? "unknown"}`, 5, 60);
  const i = z.object({ name: z.string().trim().min(3).max(120), email: z.string().trim().toLowerCase().email(), password: z.string().max(200) }).parse(await readJson(req));
  const problem = passwordProblem(i.password, i.email);
  if (problem) throw new ApiError(400, problem);
  if ((await db.select().from(schema.users).where(eq(schema.users.email, i.email)))[0]) throw new ApiError(409, "Email ini sudah terdaftar. Silakan masuk.");
  const parts = i.name.split(/\s+/);
  const id = uid("u");
  await db.insert(schema.users).values({ id, name: i.name, callName: parts[parts.length - 1], email: i.email, passwordHash: await hashPassword(i.password) });
  await logActivity({ actor: { id, name: i.name, email: i.email }, action: "Mendaftar akun", entity: "user", entityId: id, detail: "Pendaftaran mandiri", req });
  await createSession(id, req);
  return json({ ok: true });
});
