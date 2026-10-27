// Rebuilds the bundled list of Indonesian administrative regions (src/data/wilayah/wilayah.json)
// from a downloaded source file. Nothing else in the app needs to change.
//
//   npm run wilayah:update -- <berkas> --sumber "<nama sumber & dasar hukum>" --lisensi "<lisensi>"
//
// <berkas> may be:
//   • wilayah.sql from github.com/cahyadsn/wilayah (rows like  ('51.03.05.2001','Pecatu'))
//   • a CSV/TSV with two columns: kode,nama  (kode with dots: 51 / 51.03 / 51.03.05 / 51.03.05.2001)
// The file is only READ as data (parsed with simple patterns, never executed).
import { readFileSync, writeFileSync } from "fs";
import path from "path";

function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const CODE = /^\d{2}(\.\d{2}(\.\d{2}(\.\d{4})?)?)?$/;

function parse(text: string): [string, string][] {
  const sql = Array.from(text.matchAll(/\('(\d{2}(?:\.\d{2}){0,2}(?:\.\d{4})?)'\s*,\s*'((?:[^'\\]|\\.|'')*)'\)/g)).map(
    (m) => [m[1], m[2].replace(/''/g, "'").replace(/\\'/g, "'")] as [string, string]
  );
  if (sql.length) return sql;
  return text
    .split(/\r?\n/)
    .map((l) => l.split(/[\t,;](.*)/s).map((x) => x.trim().replace(/^"|"$/g, "")))
    .filter((c) => CODE.test(c[0] ?? "") && c[1])
    .map((c) => [c[0], c[1]] as [string, string]);
}

function main() {
  const file = process.argv[2];
  const source = arg("--sumber");
  const license = arg("--lisensi");
  if (!file || file.startsWith("--") || !source || !license)
    throw new Error('Pemakaian: npm run wilayah:update -- <berkas.sql|csv> --sumber "..." --lisensi "..."');

  const rows = parse(readFileSync(file, "utf8"));
  const names = new Map<string, string>();
  for (const [kode, nama] of rows) {
    if (!CODE.test(kode)) throw new Error(`Kode tidak sah: ${kode}`);
    const clean = nama.replace(/\s+/g, " ").trim();
    if (!clean || clean.length > 100) throw new Error(`Nama tidak sah untuk ${kode}`);
    names.set(kode, clean);
  }
  // Every region must have its parent in the list (no orphans).
  for (const kode of Array.from(names.keys())) {
    const parent = kode.split(".").slice(0, -1).join(".");
    if (parent && !names.has(parent)) throw new Error(`Induk ${parent} untuk ${kode} tidak ada di berkas.`);
  }
  const count = [0, 0, 0, 0];
  names.forEach((_, k) => count[k.split(".").length - 1]++);
  if (count[0] < 30 || count[1] < 400 || count[2] < 5000 || count[3] < 70000)
    throw new Error(`Jumlah wilayah terlalu sedikit (${count.join(" / ")}). Berkas sumber mungkin tidak lengkap.`);

  const out = {
    source,
    license,
    generatedAt: new Date().toISOString().slice(0, 10),
    counts: { provinsi: count[0], kabupatenKota: count[1], kecamatan: count[2], desaKelurahan: count[3] },
    rows: Array.from(names.entries()).sort((a, b) => a[0].localeCompare(b[0])),
  };
  const target = path.join(process.cwd(), "src/data/wilayah/wilayah.json");
  writeFileSync(target, JSON.stringify(out));
  console.log(`✓ ${target} diperbarui: ${count[0]} provinsi, ${count[1]} kab/kota, ${count[2]} kecamatan, ${count[3]} desa/kelurahan.`);
}

try {
  main();
} catch (e) {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
}
