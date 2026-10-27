// Creates/updates the database tables. Safe to run many times.
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL belum diisi. Salin .env.example menjadi .env lalu isi alamat database.");
    process.exit(1);
  }
  // Migrations should use a direct (non-pooled) connection when available.
  const sql = postgres(process.env.DATABASE_URL_UNPOOLED || url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  await sql.end();
  console.log("✓ Database siap (tabel sudah dibuat/diperbarui).");
}

main().catch((e) => {
  console.error("✗ Gagal menyiapkan database:", e.message);
  process.exit(1);
});
