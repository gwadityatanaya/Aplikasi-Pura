import { destroySession, getCurrent } from "@/server/auth";
import { assertSameOrigin, json, route } from "@/server/http";
import { logActivity } from "@/server/log";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const cur = await getCurrent();
  if (cur) await logActivity({ actor: { id: cur.user.id, name: cur.user.name, email: cur.user.email }, action: "Keluar", entity: "session", detail: "Sesi diakhiri", req });
  await destroySession();
  return json({ ok: true });
});
