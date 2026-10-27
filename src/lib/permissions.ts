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
  | "platform.manage";

export const ROLE_LABEL: Record<Role, string> = {
  ketua: "Ketua Pengempon",
  bendahara: "Bendahara",
  sekretaris: "Sekretaris",
  auditor: "Pemeriksa / Auditor",
  platform: "Admin Platform",
};

export const ROLE_DESC: Record<Role, string> = {
  ketua: "Melihat semua catatan, mencatat transaksi, meninjau laporan dan menyetujui tindakan penting.",
  bendahara: "Mencatat pemasukan & pengeluaran, mengelola nota, donasi dan menyiapkan laporan.",
  sekretaris: "Melihat informasi yang diizinkan dan menyiapkan draf laporan.",
  auditor: "Memeriksa riwayat transaksi, bukti nota dan catatan audit (hanya baca).",
  platform: "Mengelola pengaturan platform dan meninjau pendaftaran pura.",
};

export const ROLE_TONE: Record<Role, string> = {
  ketua: "bg-emerald-100 text-emerald-900",
  bendahara: "bg-gold-light text-gold-dark",
  sekretaris: "bg-sky-100 text-sky-900",
  auditor: "bg-violet-100 text-violet-900",
  platform: "bg-charcoal text-white",
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
  platform: ["tx.view", "report.view", "audit.view", "platform.manage", "settings.manage", "users.manage"],
};

export function can(role: Role | undefined, perm: Permission) {
  if (!role) return false;
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
  "audit.view": "Melihat catatan audit",
  "platform.manage": "Mengelola platform",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABEL) as Permission[];
export const ALL_ROLES: Role[] = ["ketua", "bendahara", "sekretaris", "auditor", "platform"];
