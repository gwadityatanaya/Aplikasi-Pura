import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { json, route } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await db.execute(sql`select 1`);
  return json({ ok: true, database: "terhubung" });
});
