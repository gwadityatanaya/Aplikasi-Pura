import type { Temple } from "./types";

/** "Desa, Kecamatan, Kabupaten" with empty parts left out ("" when no location was filled in). */
export function templeLocation(t: Pick<Temple, "village" | "district" | "regency">) {
  return [t.village, t.district, t.regency].filter((x) => x && x.trim()).join(", ");
}
