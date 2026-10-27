import { requireCurrent } from "@/server/auth";
import { cleanupHelpAttachments, loadTickets } from "@/server/commands-help";
import { ApiError, json, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** Admin Utama's help inbox (every message). Expired attachments are removed first. */
export const GET = route(async () => {
  const cur = await requireCurrent();
  if (!cur.user.isSuperAdmin) throw new ApiError(403, "Hanya Admin Utama yang dapat membuka kotak bantuan.");
  await cleanupHelpAttachments();
  return json({ ok: true, tickets: await loadTickets({}) });
});
