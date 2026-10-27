import { z } from "zod";
import { getCtx } from "@/server/context";
import { housekeeping } from "@/server/commands";
import { commands } from "@/server/registry";
import { ApiError, assertSameOrigin, json, readJson, route } from "@/server/http";
import { loadState } from "@/server/state";

export const dynamic = "force-dynamic";

/** Every change made from the app goes through here. Each command checks permissions itself. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const body = z.object({ name: z.string(), payload: z.unknown() }).parse(await readJson(req));
  const handler = commands[body.name];
  if (!handler) throw new ApiError(400, "Perintah tidak dikenal.");
  const ctx = await getCtx(req);
  try {
    const value = await handler(ctx, body.payload ?? {});
    if (Math.random() < 0.02) housekeeping().catch(() => {});
    return json({ ok: true, value, state: await loadState(ctx) });
  } catch (e) {
    if (e instanceof ApiError && e.status !== 401) {
      // Return fresh state alongside the error so the screen stays accurate.
      return json({ ok: false, error: e.message, state: await loadState(ctx).catch(() => null) }, e.status);
    }
    throw e;
  }
});
