import { execFileSync } from "child_process";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

// Phase 3.4 tahap 6 — refilling the demo site. The reset script must refuse a database that holds
// a real (non-CONTOH) temple or banjar, and must leave it untouched. A small scratch database is
// used, so neither the e2e data nor any pilot data is ever at risk.
// (That freshly seeded demo data is all marked CONTOH / (contoh) is checked by the seed script
// itself — it runs in the global setup of these tests and stops with an error otherwise.)
const E2E = process.env.E2E_DATABASE_URL!;
const SCRATCH = "pura_demo_pengaman";
const scratchUrl = () => {
  const u = new URL(E2E);
  u.pathname = `/${SCRATCH}`;
  return u.toString();
};

function reset(args: string[]) {
  try {
    const out = execFileSync("npx", ["tsx", "scripts/reset-demo.ts", ...args], {
      env: { ...process.env, DEMO_DATABASE_URL: scratchUrl(), DATABASE_URL: "postgres://bukan-dipakai.invalid/x" },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
}

test.beforeAll(async () => {
  const admin = postgres(E2E, { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${SCRATCH}`);
  await admin.unsafe(`create database ${SCRATCH}`);
  await admin.end();
  const db = postgres(scratchUrl(), { max: 1, onnotice: () => {} });
  await db.unsafe("create table temples (id text primary key, name text not null); create table banjars (id text primary key, name text not null); create table users (id text); create table donations (id text);");
  await db.end();
});
test.afterAll(async () => {
  const admin = postgres(E2E, { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${SCRATCH} with (force)`);
  await admin.end();
});

test("isi ulang demo: tanpa tanda setuju tidak jalan; --cek hanya memeriksa; menolak pura/banjar nyata", async () => {
  const db = postgres(scratchUrl(), { max: 1, onnotice: () => {} });
  try {
    // No confirmation flag → refuses.
    const none = reset([]);
    expect(none.code).toBe(1);
    expect(none.out).toContain("--cek");

    // Only demo data → the check says it is safe, shows host/database but never a password.
    await db`insert into temples values ('t1', 'CONTOH Pura Uji')`;
    const ok = reset(["--cek"]);
    expect(ok.code, ok.out).toBe(0);
    expect(ok.out).toContain(`Database tujuan: localhost/${SCRATCH} (dari DEMO_DATABASE_URL)`);
    expect(ok.out).toContain("aman diisi ulang");
    expect((await db`select count(*)::int as n from temples`)[0].n).toBe(1); // --cek deleted nothing

    // A real temple → refused, nothing deleted.
    await db`insert into temples values ('t2', 'Pura Desa Nyata')`;
    const t = reset(["--ya-hapus-data-demo"]);
    expect(t.code).toBe(1);
    expect(t.out).toContain('pura yang BUKAN data contoh (mis. "Pura Desa Nyata")');
    expect((await db`select count(*)::int as n from temples`)[0].n).toBe(2);

    // A real banjar (even without temples) → refused too.
    await db`delete from temples`;
    await db`insert into banjars values ('b1', 'Banjar Adat Nyata')`;
    const b = reset(["--ya-hapus-data-demo"]);
    expect(b.code).toBe(1);
    expect(b.out).toContain('banjar yang BUKAN data contoh (mis. "Banjar Adat Nyata")');
    expect((await db`select count(*)::int as n from banjars`)[0].n).toBe(1);
  } finally {
    await db.end();
  }
});
