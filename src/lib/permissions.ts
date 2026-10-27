import type { Role } from "./types";

export type Permission =
  | "tx.view"
  | "tx.create"
  | "tx.draft"
  | "tx.confirm"
  | "tx.reverse"
  | "donation.manage"
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
  superadmin: "Admin Utama",
  pengurus: "Pengurus Pura",
  banjar: "Pengurus Banjar",
  pemeriksa: "Pemeriksa (lihat saja)",
};

export const ROLE_DESC: Record<Role, string> = {
  superadmin: "Melihat semua pura, data, laporan dan Log Aktivitas; mengelola banjar, pura, rekening dan semua akun. Tidak dapat dihapus atau diturunkan.",
  pengurus: "Memverifikasi punia, input manual, mencatat pengeluaran, membuat laporan, dan mengatur privasi pura miliknya.",
  banjar: "Membuka dashboard dan memverifikasi punia di semua pura yang diempon banjarnya. Tidak dapat mengubah rekening atau mengelola pengguna.",
  pemeriksa: "Hanya melihat transaksi, nota, laporan dan Riwayat Audit pura.",
};

export const ROLE_TONE: Record<Role, string> = {
  superadmin: "bg-charcoal text-gold-light",
  pengurus: "bg-emerald-100 text-emerald-900",
  banjar: "bg-gold-light text-gold-dark",
  pemeriksa: "bg-violet-100 text-violet-900",
};

/** Strength order — used when one person holds several roles for the same temple. */
export const ROLE_RANK: Record<Role, number> = { superadmin: 4, pengurus: 3, banjar: 2, pemeriksa: 1 };

const MATRIX: Record<Role, Permission[]> = {
  superadmin: [],
  pengurus: [
    "tx.view", "tx.create", "tx.draft", "tx.confirm", "tx.reverse", "donation.manage", "campaign.manage",
    "activity.manage", "report.view", "report.publish", "report.export", "settings.manage", "audit.view",
  ],
  banjar: ["tx.view", "donation.manage", "report.view", "report.export", "audit.view"],
  pemeriksa: ["tx.view", "report.view", "report.export", "audit.view"],
};

export function can(role: Role | undefined, perm: Permission) {
  if (!role) return false;
  if (role === "superadmin") return true; // Admin Utama can do everything
  return MATRIX[role].includes(perm);
}

export const PERMISSION_LABEL: Record<Permission, string> = {
  "tx.view": "Melihat transaksi",
  "tx.create": "Mencatat pemasukan & pengeluaran",
  "tx.draft": "Membuat draf transaksi",
  "tx.confirm": "Mengonfirmasi transaksi",
  "tx.reverse": "Membuat koreksi",
  "donation.manage": "Verifikasi & input manual punia",
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
