import { json, route } from "@/server/http";
import { loadPublic } from "@/server/public";

export const dynamic = "force-dynamic";

export const GET = route(async () => json({ ok: true, data: await loadPublic() }));
