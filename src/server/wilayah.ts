import "server-only";
import { readFileSync } from "fs";
import path from "path";
import { ApiError } from "./http";

/**
 * Indonesian administrative regions (Kemendagri codes) from the bundled data file
 * src/data/wilayah/wilayah.json — no outside service is called. Loaded once per server instance.
 *
 * Code shape: "51" provinsi → "51.03" kab/kota → "51.03.05" kecamatan → "51.03.05.2001" desa/kelurahan.
 */
interface WilayahFile {
  source: string;
  license: string;
  generatedAt: string;
  rows: [string, string][];
}

let cache: { meta: Omit<WilayahFile, "rows">; name: Map<string, string>; children: Map<string, [string, string][]> } | null = null;

function load() {
  if (cache) return cache;
  const file = path.join(process.cwd(), "src/data/wilayah/wilayah.json");
  const data = JSON.parse(readFileSync(file, "utf8")) as WilayahFile;
  const name = new Map<string, string>();
  const children = new Map<string, [string, string][]>();
  for (const [kode, nama] of data.rows) {
    name.set(kode, nama);
    const parent = kode.includes(".") ? kode.slice(0, kode.lastIndexOf(".")) : "";
    const list = children.get(parent) ?? [];
    list.push([kode, nama]);
    children.set(parent, list);
  }
  children.forEach((list) => list.sort((a, b) => a[1].localeCompare(b[1], "id")));
  cache = { meta: { source: data.source, license: data.license, generatedAt: data.generatedAt }, name, children };
  return cache;
}

export const wilayahMeta = () => load().meta;
export const wilayahName = (kode: string) => load().name.get(kode);
/** Children of a region ("" = all provinces), sorted by name. */
export const wilayahChildren = (parent: string) => load().children.get(parent) ?? [];

export const WILAYAH_LEVELS = ["province", "regency", "district", "village"] as const;
type Level = (typeof WILAYAH_LEVELS)[number];

/** What a form sends: per level an optional code (picked from the list) and a name (manual text). */
export type AddressInput = Partial<Record<`${Level}Code`, string | null>> & Partial<Record<Level, string>>;

/**
 * Turns form input into what is stored. Codes are checked against the data file and must form a
 * chain (desa inside kecamatan inside kab/kota inside provinsi); names for picked codes always come
 * from the data file, never from the browser. Once a level is typed manually ("tidak ada di
 * daftar"), the levels below it cannot carry a code either. Everything stays optional.
 */
export function resolveAddress(i: AddressInput) {
  const out = { province: "", regency: "", district: "", village: "", provinceCode: null as string | null, regencyCode: null as string | null, districtCode: null as string | null, villageCode: null as string | null };
  let parent = "";
  let chain = true;
  for (const level of WILAYAH_LEVELS) {
    const code = (i[`${level}Code`] ?? "").trim();
    const text = (i[level] ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
    if (code) {
      if (!chain) throw new ApiError(400, "Wilayah di bawah isian manual tidak bisa dipilih dari daftar. Ketik manual juga.");
      const nama = wilayahName(code);
      const expectedDepth = WILAYAH_LEVELS.indexOf(level) + 1;
      if (!nama || code.split(".").length !== expectedDepth) throw new ApiError(400, "Kode wilayah tidak dikenal.");
      if (parent && !code.startsWith(parent + ".")) throw new ApiError(400, "Wilayah yang dipilih tidak berada di dalam wilayah di atasnya.");
      if (!parent && expectedDepth > 1) throw new ApiError(400, "Pilih wilayah tingkat atas terlebih dahulu.");
      out[`${level}Code`] = code;
      out[level] = nama;
      parent = code;
    } else {
      chain = false;
      out[level] = text;
    }
  }
  return out;
}
