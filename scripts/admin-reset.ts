// Emergency: Admin Utama forgot the password. Prints a one-time reset link (valid 1 hour).
// Only someone with the DATABASE_URL (the owner) can run this.   npm run admin:reset
import "dotenv/config";
import { createHash, randomBytes } from "crypto";
import postgres from "postgres";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum diisi di file .env");
  const sql = postgres(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL, { max: 1, prepare: false });
  const [admin] = await sql`select id, name, email from users where is_super_admin = true`;
  if (!admin) throw new Error("Belum ada Admin Utama. Gunakan halaman /setup.");
  const token = randomBytes(32).toString("base64url");
  await sql`insert into password_tokens (token_hash, user_id, purpose, expires_at, created_by)
            values (${createHash("sha256").update(token).digest("hex")}, ${admin.id}, 'reset', now() + interval '1 hour', 'skrip-darurat')`;
  await sql`insert into activity_log (actor_id, actor_name, actor_email, action, entity, entity_id, detail)
            values (${admin.id}, 'Skrip darurat', ${admin.email}, 'Membuat tautan atur ulang sandi Admin Utama', 'session', ${admin.id}, 'Dibuat dari komputer pemilik database')`;
  await sql.end();
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  console.log(`✓ Tautan untuk ${admin.name} (${admin.email}) — berlaku 1 jam, sekali pakai:\n\n  ${base}/atur-ulang-sandi?token=${token}\n`);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
