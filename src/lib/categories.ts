import type { Category, PuniaPurpose } from "./types";

/** Default categories created for every new temple. */
export function categoriesFor(templeId: string): Category[] {
  const p = templeId.replace("t_", "");
  return [
    { id: `c_${p}_punia`, templeId, name: "Dana Punia Umum", type: "income", icon: "HandHeart" },
    { id: `c_${p}_odalan`, templeId, name: "Dana Punia Odalan", type: "income", icon: "Flower2" },
    { id: `c_${p}_pembangunan`, templeId, name: "Dana Punia Pembangunan", type: "income", icon: "Building2" },
    { id: `c_${p}_sesari`, templeId, name: "Sesari / Kotak Punia", type: "income", icon: "Coins" },
    { id: `c_${p}_campaign`, templeId, name: "Donasi Penggalangan Dana", type: "income", icon: "Megaphone" },
    { id: `c_${p}_bunga`, templeId, name: "Bunga & Jasa Bank", type: "income", icon: "Landmark" },
    { id: `c_${p}_inlain`, templeId, name: "Pemasukan Lain-lain", type: "income", icon: "CirclePlus" },
    { id: `c_${p}_upakara`, templeId, name: "Upakara & Banten", type: "expense", icon: "Flower2" },
    { id: `c_${p}_utilitas`, templeId, name: "Listrik & Air", type: "expense", icon: "Zap" },
    { id: `c_${p}_honor`, templeId, name: "Honor Pemangku & Juru Sapuh", type: "expense", icon: "UserRound" },
    { id: `c_${p}_bangunan`, templeId, name: "Perbaikan & Pembangunan", type: "expense", icon: "Hammer" },
    { id: `c_${p}_konsumsi`, templeId, name: "Konsumsi & Rapat", type: "expense", icon: "UtensilsCrossed" },
    { id: `c_${p}_sewaalat`, templeId, name: "Sewa Tenda & Peralatan", type: "expense", icon: "Tent" },
    { id: `c_${p}_kebersihan`, templeId, name: "Kebersihan", type: "expense", icon: "Sparkles" },
    { id: `c_${p}_atk`, templeId, name: "ATK & Administrasi", type: "expense", icon: "FileText" },
    { id: `c_${p}_outlain`, templeId, name: "Pengeluaran Lain-lain", type: "expense", icon: "CircleMinus" },
  ];
}

/** Which income category a verified punia is booked under. */
export const PURPOSE_CATEGORY: Record<PuniaPurpose, string> = {
  umum: "Dana Punia Umum",
  odalan: "Dana Punia Odalan",
  pembangunan: "Dana Punia Pembangunan",
  lainnya: "Pemasukan Lain-lain",
};
