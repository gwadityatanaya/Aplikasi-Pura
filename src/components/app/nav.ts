import {
  Bell,
  Building2,
  FileBarChart2,
  HandCoins,
  History,
  Home,
  Layers,
  Megaphone,
  Presentation,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perm?: Permission;
  /** Shown only to Pengurus Banjar and Admin Utama */
  banjarOnly?: boolean;
  group: "main" | "manage" | "system";
}

export const NAV: NavItem[] = [
  { href: "/app", label: "Beranda", icon: Home, group: "main" },
  { href: "/app/punia", label: "Verifikasi Punia", icon: HandCoins, perm: "tx.view", group: "main" },
  { href: "/app/transaksi", label: "Pemasukan & Pengeluaran", icon: ReceiptText, perm: "tx.view", group: "main" },
  { href: "/app/kegiatan", label: "Kegiatan / Odalan", icon: Layers, group: "main" },
  { href: "/app/campaign", label: "Penggalangan Dana", icon: Megaphone, group: "main" },
  { href: "/app/laporan", label: "Laporan", icon: FileBarChart2, perm: "report.view", group: "main" },
  { href: "/app/presentasi", label: "Mode Presentasi", icon: Presentation, perm: "report.view", group: "main" },
  { href: "/app/banjar", label: "Pura Banjar Saya", icon: Building2, banjarOnly: true, group: "manage" },
  { href: "/app/notifikasi", label: "Notifikasi", icon: Bell, group: "manage" },
  { href: "/app/pengguna", label: "Pengurus Pura", icon: Users, group: "manage" },
  { href: "/app/audit", label: "Riwayat Audit Pura", icon: History, perm: "audit.view", group: "manage" },
  { href: "/app/pengaturan", label: "Pengaturan", icon: Settings, group: "manage" },
  { href: "/app/admin", label: "Back Office", icon: ShieldCheck, perm: "admin.manage", group: "system" },
  { href: "/app/log-aktivitas", label: "Log Aktivitas", icon: ScrollText, perm: "log.view", group: "system" },
];

export function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}
