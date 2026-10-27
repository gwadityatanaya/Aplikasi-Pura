// Wipes the DEMO database and fills it again with fresh fictional data.
//   npm run db:reset-demo -- --ya-hapus-data-demo
// Safety: refuses unless EVERY temple in the database is demo data (name starts with "CONTOH "),
// so it can never touch the pilot database with real temples.
import "dotenv/config";
import { execSync } from "child_process";
import postgres from "postgres";

async function main() {
  if (!process.argv.includes("--ya-hapus-data-demo"))
    throw new Error("Perintah ini MENGHAPUS seluruh isi database demo. Jalankan: npm run db:reset-demo -- --ya-hapus-data-demo");
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi di file .env");
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  const [{ exists }] = await sql`select to_regclass('public.temples') is not null as exists`;
  if (exists) {
    const real = await sql`select name from temples where name not like 'CONTOH %'`;
    if (real.length) {
      await sql.end();
      throw new Error(`Database ini berisi pura yang BUKAN data contoh (mis. "${real[0].name}"). Ini bukan database demo — tidak ada yang dihapus.`);
    }
  }
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await sql.end();
  execSync("npm run -s db:migrate", { stdio: "inherit" });
  execSync("npm run -s db:seed-demo -- --ya", { stdio: "inherit" });
  console.log("✓ Database demo sudah dikosongkan dan diisi ulang dengan data contoh.");
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
