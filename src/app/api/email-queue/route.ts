import { requireCurrent } from "@/server/auth";
import { processEmailQueue } from "@/server/email-queue";
import { puniaEmailEnabled } from "@/server/email";
import { assertSameOrigin, json, route } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sends a small batch of waiting punia emails. The pengurus screen calls this in the background
 * right after sahkan/tolak (it does not wait for it); the daily cron also calls the queue.
 */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await requireCurrent();
  if (!puniaEmailEnabled()) return json({ ok: true, sent: 0, postponed: 0 });
  return json({ ok: true, ...(await processEmailQueue(25)) });
});
