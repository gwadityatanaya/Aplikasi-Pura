import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { rateLimit } from "@/server/auth";
import { assertSameOrigin, clientIp, json, readJson, route } from "@/server/http";
import { logActivity } from "@/server/log";

export const dynamic = "force-dynamic";

/**
 * There is no email service, so a reset request is flagged for Admin Utama, who sends the
 * user a one-time link. The response is identical whether or not the email exists.
 */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await rateLimit(`forgot:${clientIp(req) ?? "unknown"}`, 5, 30);
  const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(await readJson(req));
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (u && u.status === "active") {
    await db.update(schema.users).set({ resetRequestedAt: new Date() }).where(eq(schema.users.id, u.id));
    await logActivity({ actor: { id: u.id, name: u.name, email }, action: "Meminta atur ulang sandi", entity: "session", detail: "Menunggu tautan dari Admin Utama", req });
  }
  return json({ ok: true });
});
