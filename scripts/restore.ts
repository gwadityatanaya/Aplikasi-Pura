// Restores a backup file into an EMPTY database:  npm run restore -- cadangan/pura-....json
import "dotenv/config";
import { readFileSync } from "fs";
import postgres from "postgres";
import { BACKUP_TABLES } from "../src/server/backup";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Sebutkan file cadangan. Contoh: npm run restore -- cadangan/pura-2026-10-27.json");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum diisi di file .env");
  const backup = JSON.parse(readFileSync(file, "utf8"));
  if (backup.format !== "pura-backup") throw new Error("File ini bukan cadangan PURA.");
  const sql = postgres(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
  const [{ n }] = await sql`select count(*)::int as n from users`;
  if (n > 0) throw new Error("Database tujuan tidak kosong. Pulihkan ke database baru (jalankan `npm run db:migrate` dulu).");
  await sql.begin(async (tx) => {
    for (const table of BACKUP_TABLES) {
      const rows = (backup.tables[table] ?? []) as Record<string, unknown>[];
      if (!rows.length) continue;
      if (table === "attachments") {
        for (const r of rows) {
          if (!r.data_base64) continue; // backups made in the app do not contain photos
          await tx`insert into attachments (id, temple_id, mime, data, size, is_public, created_by, created_at)
                   values (${r.id as string}, ${r.temple_id as string}, ${r.mime as string}, decode(${r.data_base64 as string}, 'base64'), ${r.size as number}, ${r.is_public as boolean}, ${r.created_by as string}, ${r.created_at as string})`;
        }
        continue;
      }
      for (let i = 0; i < rows.length; i += 200) {
        await tx`insert into ${tx(table)} ${tx(rows.slice(i, i + 200) as any)}`;
      }
    }
    await tx`select setval(pg_get_serial_sequence('activity_log', 'id'), coalesce((select max(id) from activity_log), 1))`;
  });
  await sql.end();
  console.log(`✓ Data dari ${file} berhasil dipulihkan.`);
  if (!backup.includesImages) console.log("  Catatan: cadangan ini dibuat dari aplikasi sehingga tidak berisi foto nota.");
}

main().catch((e) => {
  console.error("✗ Gagal memulihkan:", e.message);
  process.exit(1);
});
