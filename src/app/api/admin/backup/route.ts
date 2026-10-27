import { getCtx, requireSuperAdmin } from "@/server/context";
import { route } from "@/server/http";
import { logActivity } from "@/server/log";
import { exportDatabase } from "@/server/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Downloads a JSON backup of all data (photos excluded to keep the file small). Admin Utama only. */
export const GET = route(async (req: Request) => {
  const ctx = await getCtx(req);
  await requireSuperAdmin(ctx, "mengunduh cadangan data");
  const data = await exportDatabase({ includeImages: false });
  await logActivity({ actor: ctx.actor, action: "Mengunduh cadangan data", entity: "backup", detail: "Cadangan JSON (tanpa foto) diunduh dari aplikasi", req });
  const name = `cadangan-pura-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
});
