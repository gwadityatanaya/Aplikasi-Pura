// Shared by the in-app download and the `npm run backup` / `npm run restore` scripts.
import { sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";

/** Tables in restore order (parents before children). Sessions, tokens and rate limits are never backed up. */
export const BACKUP_TABLES = [
  "users", "temples", "memberships", "accounts", "categories", "activities", "campaigns", "transactions",
  "donations", "reports", "notifications", "attachments", "activity_log",
] as const;

type AnyDb = PgDatabase<any, any, any>;

export async function exportDatabase(opts: { includeImages: boolean }, database?: AnyDb) {
  const d = database ?? (await import("./db")).db;
  const tables: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    if (t === "attachments") {
      const rows = await d.execute(
        opts.includeImages
          ? sql`select id, temple_id, mime, encode(data, 'base64') as data_base64, size, is_public, created_by, created_at from attachments`
          : sql`select id, temple_id, mime, size, is_public, created_by, created_at from attachments`
      );
      tables[t] = Array.from(rows as unknown as unknown[]);
      continue;
    }
    const rows = await d.execute(sql.raw(`select * from "${t}"`));
    tables[t] = Array.from(rows as unknown as unknown[]);
  }
  return {
    format: "pura-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    includesImages: opts.includeImages,
    note: "File ini berisi data keuangan dan hash kata sandi. Simpan di tempat yang aman dan jangan dibagikan.",
    tables,
  };
}
