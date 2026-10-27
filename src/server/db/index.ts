import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL belum diisi. Lihat file .env.example dan docs/PANDUAN.md.");

// One small pool per server instance. `prepare: false` keeps it compatible with
// connection poolers such as Neon's pooled URL and Supabase's pooler.
const globalForDb = globalThis as unknown as { __puraSql?: ReturnType<typeof postgres> };
const client =
  globalForDb.__puraSql ??
  postgres(url, { prepare: false, max: process.env.NODE_ENV === "production" ? 5 : 10, idle_timeout: 20 });
if (process.env.NODE_ENV !== "production") globalForDb.__puraSql = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
