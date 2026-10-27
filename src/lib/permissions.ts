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
  | "users.manage"
  | "settings.manage"
  | "audit.view"
  | "admin.manage"
  | "log.view";

export const ROLE_LABEL: Record<Role, string> = {
  ketua: "Ketua Pengempon",
  bendahara: "Bendahara",
  sekretaris: "Sekretaris",
  auditor: "Pemeriksa / Auditor",
  superadmin: "Admin Utama",
};

export const ROLE_DESC: Record<Role, string> = {
  ketua: "Melihat semua catatan, mencatat transaksi, meninjau laporan dan menyetujui tindakan penting.",
  bendahara: "Mencatat pemasukan & pengeluaran, mengelola nota, donasi dan menyiapkan laporan.",
  sekretaris: "Melihat informasi yang diizinkan dan menyiapkan draf laporan.",
  auditor: "Memeriksa riwayat transaksi, bukti nota dan catatan audit (hanya baca).",
  superadmin: "Melihat semua data & laporan, mengelola semua pengguna dan peran, serta melihat Log Aktivitas. Tidak dapat dihapus atau diturunkan.",
};

export const ROLE_TONE: Record<Role, string> = {
  ketua: "bg-emerald-100 text-emerald-900",
  bendahara: "bg-gold-light text-gold-dark",
  sekretaris: "bg-sky-100 text-sky-900",
  auditor: "bg-violet-100 text-violet-900",
  superadmin: "bg-charcoal text-gold-light",
};

const MATRIX: Record<Role, Permission[]> = {
  ketua: [
    "tx.view", "tx.create", "tx.draft", "tx.confirm", "tx.reverse", "donation.manage", "campaign.manage",
    "activity.manage", "report.view", "report.publish", "report.export", "users.manage", "settings.manage", "audit.view",
  ],
  bendahara: [
    "tx.view", "tx.create", "tx.draft", "tx.confirm", "tx.reverse", "donation.manage", "campaign.manage",
    "activity.manage", "report.view", "report.export", "settings.manage", "audit.view",
  ],
  sekretaris: ["tx.view", "tx.draft", "report.view", "report.export"],
  auditor: ["tx.view", "report.view", "report.export", "audit.view"],
  superadmin: [],
};

export function can(role: Role | undefined, perm: Permission) {
  if (!role) return false;
  if (role === "superadmin") return true; // Admin Utama can do everything
  return MATRIX[role].includes(perm);
}

export const PERMISSION_LABEL: Record<Permission, string> = {
  "tx.view": "Melihat transaksi",
  "tx.create": "Mencatat transaksi",
  "tx.draft": "Membuat draf transaksi",
  "tx.confirm": "Mengonfirmasi transaksi",
  "tx.reverse": "Membuat koreksi",
  "donation.manage": "Mengelola & verifikasi donasi",
  "campaign.manage": "Mengelola campaign",
  "activity.manage": "Mengelola kegiatan",
  "report.view": "Melihat laporan",
  "report.publish": "Mempublikasikan laporan",
  "report.export": "Mengunduh laporan",
  "users.manage": "Mengelola pengguna",
  "settings.manage": "Mengubah pengaturan",
  "audit.view": "Melihat riwayat audit pura",
  "admin.manage": "Mengelola semua pengguna & pura",
  "log.view": "Melihat Log Aktivitas (login & perubahan)",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABEL) as Permission[];
export const ALL_ROLES: Role[] = ["ketua", "bendahara", "sekretaris", "auditor", "superadmin"];
export const MEMBER_ROLES = ["ketua", "bendahara", "sekretaris", "auditor"] as const;
