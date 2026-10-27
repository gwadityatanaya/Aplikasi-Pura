// Fills an EMPTY database with fictional demo data for trying out the app and for the e2e tests.
// Every name, email and account number is made up. It refuses to run on a database that
// already has temples, so it can never mix demo data into real data.
//   npm run db:seed-demo -- --ya
import "dotenv/config";
import { crc32, deflateSync } from "zlib";
import { eq, sql } from "drizzle-orm";
import { db, schema as T } from "@/server/db";
import { roleFor, type Ctx } from "@/server/context";
import { commands } from "@/server/registry";
import { callNameOf, uid } from "@/lib/format";

type UserRow = typeof T.users.$inferSelect;

/** A small, valid PNG in one colour — stands in for a photo of a transfer receipt. */
function fakeReceipt(seed: number) {
  const w = 24;
  const h = 32;
  const rgb = [(seed * 67) % 256, (seed * 131) % 256, (seed * 199) % 256];
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(y < 4 ? [20, 120, 90] : rgb, y * (w * 3 + 1) + 1 + x * 3);
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

const req = new Request("http://localhost/seed", { headers: { "user-agent": "seed-demo" } });

async function userByEmail(email: string) {
  const [u] = await db.select().from(T.users).where(sql`lower(${T.users.email}) = ${email.toLowerCase()}`);
  if (!u) throw new Error(`Pengguna ${email} tidak ada`);
  return u;
}

async function ctxFor(user: UserRow, templeId: string | null = null): Promise<Ctx> {
  return {
    session: { id: "seed", activeTempleId: templeId } as Ctx["session"],
    user,
    req,
    templeId,
    role: await roleFor(user, templeId),
    actor: { id: user.id, name: user.name, email: user.email },
  };
}

async function run<T = unknown>(user: UserRow, templeId: string | null, name: string, payload: unknown): Promise<T> {
  return (await commands[name](await ctxFor(user, templeId), payload)) as T;
}

const daysAgo = (n: number) => {
  const d = new Date(Date.now() + 8 * 3600_000 - n * 86400_000);
  return d.toISOString().slice(0, 10);
};

async function main() {
  if (!process.argv.includes("--ya"))
    throw new Error("Perintah ini mengisi data FIKTIF. Jalankan ulang dengan: npm run db:seed-demo -- --ya");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(T.temples);
  if (n > 0) throw new Error("Database sudah berisi pura. Data contoh hanya boleh diisi ke database KOSONG (agar tidak tercampur dengan data asli).");

  // Admin Utama: the one from /setup, or a fictional one for a pure demo database.
  let [admin] = await db.select().from(T.users).where(eq(T.users.isSuperAdmin, true));
  if (!admin) {
    const email = (process.env.ADMIN_EMAIL || "admin@contoh.id").trim().toLowerCase();
    [admin] = await db.insert(T.users).values({ id: uid("u"), name: "Admin Utama", callName: "Admin", email, isSuperAdmin: true, avatarColor: "#17212B" }).returning();
    console.log(`• Admin Utama dibuat: ${email}`);
  }

  // Real places (Kemendagri codes from the bundled region list); the banjar and temples are fictional.
  const mengwi = { provinceCode: "51", regencyCode: "51.03", districtCode: "51.03.02", villageCode: "51.03.02.2009" }; // Bali › Badung › Mengwi › Mengwi
  const ubud = { provinceCode: "51", regencyCode: "51.04", districtCode: "51.04.05", villageCode: "51.04.05.2002" }; // Bali › Gianyar › Ubud › Mas
  const bjA = await run<{ id: string }>(admin, null, "saveBanjar", { name: "CONTOH Banjar Adat Kertha Sari", ...mengwi, address: "Jalan Contoh (fiktif)" });
  const bjB = await run<{ id: string }>(admin, null, "saveBanjar", { name: "CONTOH Banjar Adat Tunjung Mekar", ...ubud });

  const base = { ...mengwi, phone: "0800-0000-0000" };
  // Every name and account number below is made up. Temple names start with "CONTOH", banks are
  // "Bank CONTOH (fiktif)" and account numbers are runs of zeros, so nobody mistakes them for real ones.
  const fakeBank = (n: number, holder: string) => ["Bank CONTOH (fiktif)", `000-000-000${n}`, `CONTOH — ${holder}`];
  const templeDefs = [
    { key: "desa", name: "CONTOH Pura Desa Sukamerta", banjarIds: [bjA.id], bank: fakeBank(1, "Pengurus Pura Desa") },
    { key: "puseh", name: "CONTOH Pura Puseh Sukamerta", banjarIds: [bjA.id], bank: fakeBank(2, "Pengurus Pura Puseh") },
    { key: "dalem", name: "CONTOH Pura Dalem Kahyangan", banjarIds: [bjA.id], bank: fakeBank(3, "Pengurus Pura Dalem") },
    { key: "melanting", name: "CONTOH Pura Melanting Pasar", banjarIds: [bjA.id], bank: fakeBank(4, "Banjar Adat Kertha Sari") },
    { key: "segara", name: "CONTOH Pura Segara Bersama", banjarIds: [bjA.id, bjB.id], bank: fakeBank(5, "Pengurus Pura Segara") },
    { key: "taman", name: "CONTOH Pura Taman Tunjung", banjarIds: [bjB.id], bank: fakeBank(6, "Pengurus Pura Taman") },
  ];
  const temples: Record<string, string> = {};
  for (const t of templeDefs) {
    // Pura Melanting is registered with the bare minimum (name + banjar): no address, phone or email.
    const r = await run<{ id: string }>(admin, null, "adminSaveTemple", t.key === "melanting"
      ? { name: t.name, banjarIds: t.banjarIds }
      : { ...base, ...(t.key === "taman" ? ubud : {}), name: t.name, address: `Jalan Contoh No. ${templeDefs.indexOf(t) + 1} (fiktif)`, description: `DATA CONTOH — ${t.name.replace("CONTOH ", "")} adalah pura fiktif untuk mencoba aplikasi PURA. Jangan mentransfer ke rekening ini.`, banjarIds: t.banjarIds });
    temples[t.key] = r.id;
    await run(admin, null, "setTempleBank", { templeId: r.id, bankName: t.bank[0], bankAccountNumber: t.bank[1], bankAccountHolder: t.bank[2] });
  }

  const staff: [string, string, "pengurus" | "pemeriksa" | "banjar", string][] = [
    ["ketut.banjar@contoh.id", "I Ketut Wirawan (contoh)", "banjar", bjA.id],
    ["gede.banjar@contoh.id", "I Gede Sutama (contoh)", "banjar", bjB.id],
    ["wayan@contoh.id", "I Wayan Sudarma (contoh)", "pengurus", temples.desa], // Pura Desa: hanya 1 pengurus (muncul peringatan)
    ["wayan@contoh.id", "I Wayan Sudarma (contoh)", "pengurus", temples.puseh],
    ["putu@contoh.id", "Ni Putu Ariani (contoh)", "pengurus", temples.puseh],
    ["made@contoh.id", "I Made Suarjana (contoh)", "pengurus", temples.dalem],
    ["komang@contoh.id", "I Komang Adi (contoh)", "pengurus", temples.dalem],
    ["made@contoh.id", "I Made Suarjana (contoh)", "pengurus", temples.segara],
    ["nengah@contoh.id", "I Nengah Raka (contoh)", "pengurus", temples.segara],
    ["kadek.taman@contoh.id", "Kadek Yuliani (contoh)", "pengurus", temples.taman],
    ["oka.pemeriksa@contoh.id", "I Gusti Oka (contoh)", "pemeriksa", temples.dalem],
    // Pura Melanting Pasar sengaja tanpa pengurus: punianya diverifikasi Pengurus Banjar.
  ];
  for (const [email, name, kind, target] of staff)
    await run(admin, null, "adminAddStaff", kind === "banjar" ? { email, name, kind, banjarId: target } : { email, name, kind, templeId: target });

  const umatNames: [string, string][] = [["ayu@contoh.id", "Ni Luh Ayu Lestari (contoh)"], ["nyoman@contoh.id", "I Nyoman Darma (contoh)"], ["kadek@contoh.id", "Kadek Surya (contoh)"]];
  for (const [email, name] of umatNames) {
    await db.insert(T.users).values({ id: uid("u"), name, callName: callNameOf(name), email, avatarColor: "#0F766E" });
  }

  // Opening balance for the cash book, as filled in by the pengurus.
  const made = await userByEmail("made@contoh.id");
  const komang = await userByEmail("komang@contoh.id");
  const [cash] = await db.select().from(T.accounts).where(sql`${T.accounts.templeId} = ${temples.dalem} and ${T.accounts.type} = 'cash'`);
  if (cash) await run(made, temples.dalem, "saveAccount", { id: cash.id, name: cash.name, type: "cash", openingBalance: 2_500_000, openingDate: daysAgo(60) });

  // Punia from umat: some verified, some still waiting, one anonymous.
  let img = 1;
  const ayu = await userByEmail("ayu@contoh.id");
  const nyoman = await userByEmail("nyoman@contoh.id");
  const kadek = await userByEmail("kadek@contoh.id");
  const submit = (u: UserRow, templeKey: string, amount: number, days: number, anonymous: boolean, purpose = "umum") =>
    run<{ id: string }>(u, null, "submitPunia", { templeId: temples[templeKey], amount, transferDate: daysAgo(days), evidence: fakeReceipt(img++), anonymous, purpose });

  const p1 = await submit(ayu, "dalem", 250_000, 20, false, "odalan");
  const p2 = await submit(nyoman, "dalem", 500_000, 15, true, "pembangunan");
  await submit(kadek, "dalem", 100_000, 2, false);
  await run(komang, temples.dalem, "verifyPunia", { ids: [p1.id, p2.id] });
  const p4 = await submit(ayu, "segara", 150_000, 10, true);
  await run(await userByEmail("nengah@contoh.id"), temples.segara, "verifyPunia", { ids: [p4.id] });
  await submit(nyoman, "melanting", 75_000, 3, false); // menunggu Pengurus Banjar
  await submit(kadek, "desa", 200_000, 4, false, "odalan");

  // Punia handed over in cash, typed in by a pengurus (verified straight away).
  await run(made, temples.dalem, "addManualPunia", { donorName: "Keluarga I Ketut Rai (contoh)", amount: 300_000, transferDate: daysAgo(8), anonymous: false, purpose: "odalan", channel: "tunai" });

  // A couple of expenses.
  const cats = await db.select().from(T.categories).where(sql`${T.categories.templeId} = ${temples.dalem} and ${T.categories.type} = 'expense'`);
  const cat = (name: string) => cats.find((c) => c.name === name)?.id ?? cats[0]?.id;
  for (const [amount, days, desc, c] of [[425_000, 12, "Bunga, janur & buah untuk banten", "Upakara & Banten"], [180_000, 6, "Sapu, lampu, dan alat kebersihan", "Kebersihan"]] as const)
    await run(made, temples.dalem, "addTransaction", {
      key: uid("seed"),
      input: { type: "expense", amount, date: daysAgo(days), categoryId: cat(c), description: desc, accountId: cash.id, status: "confirmed" },
    });

  console.log("✓ Data contoh selesai dibuat.");
  console.log("  Banjar: Kertha Sari (5 pura) dan Tunjung Mekar (2 pura, 1 dipakai bersama).");
  console.log("  Pengurus Banjar: ketut.banjar@contoh.id, gede.banjar@contoh.id");
  console.log("  Pengurus Pura: wayan@, putu@, made@, komang@, nengah@, kadek.taman@contoh.id");
  console.log("  Umat: ayu@, nyoman@, kadek@contoh.id");
  console.log("  Masuk dengan 'Kirim tautan masuk' — saat SMTP belum diatur, tautan tampil langsung di layar (mode pengembangan).");
  process.exit(0);
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
