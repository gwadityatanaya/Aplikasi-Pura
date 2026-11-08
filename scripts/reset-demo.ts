// Wipes the DEMO database and fills it again with fresh fictional data.
//   npm run db:reset-demo -- --cek                  (only shows what would happen; deletes nothing)
//   npm run db:reset-demo -- --ya-hapus-data-demo
// Which database: DEMO_DATABASE_URL when set (recommended: then DATABASE_URL in .env can keep
// pointing at the pilot without any risk), otherwise DATABASE_URL.
// Safety: refuses unless EVERY temple and banjar in that database is demo data (name starts with
// "CONTOH "), so it can never touch the pilot database with real temples.
import "dotenv/config";
import { execSync } from "child_process";
import postgres from "postgres";

/** Host + database name only, never the password. */
function describe(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(alamat tidak terbaca)";
  }
}

async function main() {
  const check = process.argv.includes("--cek");
  if (!check && !process.argv.includes("--ya-hapus-data-demo"))
    throw new Error("Perintah ini MENGHAPUS seluruh isi database demo. Periksa dulu: npm run db:reset-demo -- --cek. Lalu jalankan: npm run db:reset-demo -- --ya-hapus-data-demo");
  const fromDemoVar = !!process.env.DEMO_DATABASE_URL;
  const url = process.env.DEMO_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("Isi DEMO_DATABASE_URL (alamat database DEMO) di file .env");
  console.log(`• Database tujuan: ${describe(url)} (dari ${fromDemoVar ? "DEMO_DATABASE_URL" : "DATABASE_URL"})`);

  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  const [{ exists }] = await sql`select to_regclass('public.temples') is not null as exists`;
  if (exists) {
    const real = [
      ...(await sql`select 'pura' as kind, name from temples where name not like 'CONTOH %'`),
      ...(await sql`select 'banjar' as kind, name from banjars where name not like 'CONTOH %'`),
    ];
    if (real.length) {
      await sql.end();
      throw new Error(`Database ini berisi ${real[0].kind} yang BUKAN data contoh (mis. "${real[0].name}"). Ini bukan database demo — tidak ada yang dihapus.`);
    }
    const [c] = await sql`select (select count(*) from temples)::int as temples, (select count(*) from users)::int as users, (select count(*) from donations)::int as donations`;
    console.log(`• Isi sekarang: ${c.temples} pura (semuanya CONTOH), ${c.users} akun, ${c.donations} punia.`);
  } else console.log("• Database masih kosong.");
  if (check) {
    await sql.end();
    console.log("✓ Pemeriksaan selesai: database ini aman diisi ulang. Tidak ada yang dihapus (mode --cek).");
    return;
  }
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await sql.end();
  // The child commands use exactly this database, whatever DATABASE_URL in .env says.
  const env = { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url };
  execSync("npm run -s db:migrate", { stdio: "inherit", env });
  execSync("npm run -s db:seed-demo -- --ya", { stdio: "inherit", env });
  console.log("✓ Database demo sudah dikosongkan dan diisi ulang dengan data contoh.");
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
