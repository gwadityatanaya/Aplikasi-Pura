// Change the email address of the Admin Utama (e.g. the old Gmail was lost). The account, its role
// and all history stay the same; only the address used to sign in changes. Only someone with the
// DATABASE_URL can run this. The change is written to the Log Aktivitas.
//   npm run admin:ganti-email -- --email-baru=alamat.baru@gmail.com --ya
import "dotenv/config";
import postgres from "postgres";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi di file .env");
  const email = (arg("email-baru") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) throw new Error("Tulis email baru: npm run admin:ganti-email -- --email-baru=alamat@gmail.com --ya");
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const [admin] = await sql`select id, name, email from users where is_super_admin = true`;
    if (!admin) throw new Error("Belum ada Admin Utama. Gunakan halaman /setup.");
    if (admin.email.toLowerCase() === email) {
      console.log(`Email Admin Utama sudah ${email}. Tidak ada yang diubah.`);
      return;
    }
    const [other] = await sql`select name, status from users where lower(email) = ${email} and id <> ${admin.id}`;
    if (other) throw new Error(`Email ${email} sudah dipakai akun lain (${other.name}, ${other.status}). Ganti atau hapus email akun itu dulu.`);
    if (!process.argv.includes("--ya")) {
      console.log(`Akan mengganti email Admin Utama ${admin.name}: ${admin.email} → ${email}.\nSemua sesi Admin Utama akan keluar. Jalankan lagi dengan --ya untuk melanjutkan.`);
      return;
    }
    await sql.begin(async (tx) => {
      // google_sub is cleared: the OLD Google account must no longer sign in as Admin Utama.
      await tx`update users set email = ${email}, google_sub = null where id = ${admin.id}`;
      await tx`delete from sessions where user_id = ${admin.id}`;
      await tx`delete from password_tokens where user_id = ${admin.id}`;
      await tx`insert into activity_log (actor_id, actor_name, actor_email, action, entity, entity_id, detail)
               values (${admin.id}, 'Skrip ganti email', ${email}, 'Mengganti email Admin Utama', 'user', ${admin.id}, ${`Dari ${admin.email} ke ${email} (dijalankan dari komputer pemilik database). Akun dan riwayat tetap sama.`})`;
    });
    console.log(`✓ Email Admin Utama diganti: ${admin.email} → ${email}.\n  Masuk lagi dengan Google memakai ${email}, atau jalankan "npm run admin:reset" untuk tautan masuk sekali pakai.`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
