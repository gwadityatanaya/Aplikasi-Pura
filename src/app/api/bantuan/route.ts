import { requireCurrent } from "@/server/auth";
import { loadTickets } from "@/server/commands-help";
import { json, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** The signed-in person's own help messages and the replies to them. */
export const GET = route(async () => {
  const cur = await requireCurrent();
  return json({ ok: true, tickets: await loadTickets({ userId: cur.user.id }) });
});
