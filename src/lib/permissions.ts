import type { Role } from "./types";

export type Permission =
  | "tx.view"
  | "tx.create"
  | "tx.draft"
  | "tx.confirm"
  | "tx.reverse"
  | "donation.manage"
  | "donation.correct"
  | "campaign.manage"
  | "activity.manage"
  | "report.view"
  | "report.publish"
  | "report.export"
  | "settings.manage"
  | "audit.view"
  | "bank.manage"
  | "admin.manage"
  | "log.view";

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Admin Utama (mode darurat)",
  admin_view: "Admin Utama (mode lihat)",
  pengurus: "Pengurus Pura",
  banjar: "Pengurus Banjar",
  pemeriksa: "Pemeriksa (lihat saja)",
};

export const ROLE_DESC: Record<Role, string> = {
  superadmin: "Melihat semua pura, data, laporan dan Log Aktivitas; mengelola banjar, pura, rekening dan semua akun. Mengubah data keuangan pura hanya lewat Mode darurat (dengan alasan, tercatat). Tidak dapat dihapus atau diturunkan.",
  admin_view: "Admin Utama yang sedang melihat dashboard pura. Untuk mengesahkan, menolak atau mengoreksi, aktifkan Mode darurat dengan alasan.",
  pengurus: "Memverifikasi punia, input manual, mencatat pengeluaran, membuat laporan, dan mengatur privasi pura miliknya.",
  banjar: "Membuka dashboard, mengesahkan, menolak dan mengoreksi punia di semua pura yang diempon banjarnya (termasuk pura tanpa pengurus). Tidak dapat mengubah rekening atau mengelola pengguna.",
  pemeriksa: "Hanya melihat transaksi, nota, laporan dan Riwayat Audit pura.",
};

export const ROLE_TONE: Record<Role, string> = {
  superadmin: "bg-charcoal text-gold-light",
  admin_view: "bg-charcoal text-gold-light",
  pengurus: "bg-emerald-100 text-emerald-900",
  banjar: "bg-gold-light text-gold-dark",
  pemeriksa: "bg-violet-100 text-violet-900",
};

/** Strength order — used when one person holds several roles for the same temple. */
export const ROLE_RANK: Record<Role, number> = { superadmin: 5, admin_view: 4, pengurus: 3, banjar: 2, pemeriksa: 1 };

const MATRIX: Record<Role, Permission[]> = {
  superadmin: [],
  // Admin Utama looking at a temple: everything visible, Back Office available, temple data read-only.
  admin_view: ["tx.view", "report.view", "report.export", "audit.view", "bank.manage", "admin.manage", "log.view"],
  pengurus: [
    "tx.view", "tx.create", "tx.draft", "tx.confirm", "tx.reverse", "donation.manage", "donation.correct", "campaign.manage",
    "activity.manage", "report.view", "report.publish", "report.export", "settings.manage", "audit.view",
  ],
  // Pengurus Banjar: sahkan / tolak / koreksi punia at every temple its banjar supports
  // (incl. temples without pengurus). No other ledger changes.
  banjar: ["tx.view", "donation.manage", "donation.correct", "report.view", "report.export", "audit.view"],
  pemeriksa: ["tx.view", "report.view", "report.export", "audit.view"],
};

/** Permissions that change a temple's data — refused while the temple is archived (read-only). */
export const WRITE_PERMS = new Set<Permission>([
  "tx.create", "tx.draft", "tx.confirm", "tx.reverse", "donation.manage", "donation.correct",
  "campaign.manage", "activity.manage", "report.publish", "settings.manage",
]);

export function can(role: Role | undefined, perm: Permission) {
  if (!role) return false;
  if (role === "superadmin") return true; // Admin Utama in emergency mode for this temple
  return MATRIX[role].includes(perm);
}

export const PERMISSION_LABEL: Record<Permission, string> = {
  "tx.view": "Melihat transaksi",
  "tx.create": "Mencatat pemasukan & pengeluaran",
  "tx.draft": "Membuat draf transaksi",
  "tx.confirm": "Mengonfirmasi transaksi",
  "tx.reverse": "Membuat koreksi",
  "donation.manage": "Mengesahkan, menolak & input manual punia",
  "donation.correct": "Mengoreksi punia yang sudah disahkan",
  "campaign.manage": "Mengelola kegiatan/odalan & campaign",
  "activity.manage": "Mengelola kegiatan",
  "report.view": "Melihat laporan",
  "report.publish": "Mempublikasikan laporan",
  "report.export": "Mengunduh laporan (PDF/Excel)",
  "settings.manage": "Mengatur privasi & pengaturan pura",
  "audit.view": "Melihat Riwayat Audit Pura",
  "bank.manage": "Mengubah info rekening pura",
  "admin.manage": "Back Office: banjar, pura & akun",
  "log.view": "Melihat Log Aktivitas",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABEL) as Permission[];
export const ALL_ROLES: Role[] = ["superadmin", "pengurus", "banjar", "pemeriksa"];
export const MEMBER_ROLES = ["pengurus", "pemeriksa"] as const;

export const PURPOSE_LABEL = { umum: "Umum", odalan: "Odalan / Piodalan", pembangunan: "Pembangunan", lainnya: "Lainnya" } as const;

/** Jabatan names. Temples have Ketua/Sekretaris/Bendahara; a banjar has a Kelian Banjar. */
export const POSITION_LABEL = {
  ketua: "Ketua",
  sekretaris: "Sekretaris",
  bendahara: "Bendahara",
  kelian_banjar: "Kelian Banjar",
  lainnya: "Lainnya",
} as const;
export const TEMPLE_POSITIONS = ["ketua", "sekretaris", "bendahara", "lainnya"] as const;
export const BANJAR_POSITIONS = ["kelian_banjar", "sekretaris", "bendahara", "lainnya"] as const;
export const positionName = (p?: string | null, title?: string | null) =>
  !p ? "" : p === "lainnya" ? (title?.trim() || "Lainnya") : POSITION_LABEL[p as keyof typeof POSITION_LABEL] ?? p;
