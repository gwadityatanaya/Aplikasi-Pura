import { getCurrent } from "@/server/auth";
import { getCtx } from "@/server/context";
import { json, route } from "@/server/http";
import { loadState } from "@/server/state";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  if (!(await getCurrent())) return json({ ok: true, state: null, registrationOpen: process.env.ALLOW_REGISTRATION === "true" });
  const ctx = await getCtx(req);
  return json({ ok: true, state: await loadState(ctx) });
});
