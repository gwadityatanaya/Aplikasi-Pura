import { execSync } from "child_process";
import postgres from "postgres";
import { setupDbUrl } from "../playwright.config";

/** Wipes the e2e database and fills it with the fictional demo data. */
export default async function globalSetup() {
  await prepareEmptySetupDb();
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("Isi E2E_DATABASE_URL dengan database KHUSUS tes (nama mengandung 'test' atau 'e2e').");
  const name = new URL(url).pathname.slice(1);
  if (!/test|e2e/i.test(name)) throw new Error(`Database "${name}" bukan database tes. Nama harus mengandung 'test' atau 'e2e'.`);
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await sql.end();
  const env = { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url, ADMIN_EMAIL: "admin@contoh.id" };
  execSync("npm run -s db:migrate", { env, stdio: "inherit" });
  execSync("npm run -s db:seed-demo -- --ya", { env, stdio: "inherit" });
}

/**
 * The second test server starts from a completely EMPTY database (no Admin Utama, no temples),
 * like a brand-new deployment right before /setup.
 */
async function prepareEmptySetupDb() {
  const main = process.env.E2E_DATABASE_URL!;
  const url = setupDbUrl();
  const name = new URL(url).pathname.slice(1);
  if (!/test|e2e/i.test(name)) throw new Error(`Database "${name}" bukan database tes.`);
  const admin = postgres(main, { max: 1, onnotice: () => {} });
  const [exists] = await admin`select 1 from pg_database where datname = ${name}`;
  if (!exists) await admin.unsafe(`create database "${name.replace(/"/g, "")}"`);
  await admin.end();
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await sql.end();
  execSync("npm run -s db:migrate", { env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url }, stdio: "inherit" });
}
