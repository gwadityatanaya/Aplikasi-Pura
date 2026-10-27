// Full backup (including photos) to a JSON file:  npm run backup
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { exportDatabase } from "../src/server/backup";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum diisi di file .env");
  const sql = postgres(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL, { max: 1, prepare: false });
  const data = await exportDatabase({ includeImages: true }, drizzle(sql));
  await sql.end();
  mkdirSync("cadangan", { recursive: true });
  const file = `cadangan/pura-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
  writeFileSync(file, JSON.stringify(data));
  const counts = Object.entries(data.tables).map(([k, v]) => `${k}: ${v.length}`).join(", ");
  console.log(`✓ Cadangan tersimpan di ${file}\n  (${counts})`);
}

main().catch((e) => {
  console.error("✗ Gagal membuat cadangan:", e.message);
  process.exit(1);
});
