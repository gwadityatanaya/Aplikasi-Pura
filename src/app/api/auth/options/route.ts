import { signInOptions } from "@/server/email";
import { json, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** Public: which sign-in buttons to show (no secrets, only true/false). */
export const GET = route(async () => json({ ok: true, ...signInOptions() }));
