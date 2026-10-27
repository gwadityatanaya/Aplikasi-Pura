import {
  Bell,
  FileBarChart2,
  History,
  Home,
  Layers,
  Megaphone,
  Presentation,
  ReceiptText,
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
  group: "main" | "manage" | "system";
}

export const NAV: NavItem[] = [
  { href: "/app", label: "Beranda", icon: Home, group: "main" },
  { href: "/app/transaksi", label: "Transaksi", icon: ReceiptText, perm: "tx.view", group: "main" },
  { href: "/app/kegiatan", label: "Kegiatan", icon: Layers, group: "main" },
  { href: "/app/campaign", label: "Penggalangan Dana", icon: Megaphone, group: "main" },
  { href: "/app/laporan", label: "Laporan", icon: FileBarChart2, perm: "report.view", group: "main" },
  { href: "/app/presentasi", label: "Mode Presentasi", icon: Presentation, perm: "report.view", group: "main" },
  { href: "/app/notifikasi", label: "Notifikasi", icon: Bell, group: "manage" },
  { href: "/app/pengguna", label: "Pengurus & Peran", icon: Users, group: "manage" },
  { href: "/app/audit", label: "Riwayat Audit", icon: History, perm: "audit.view", group: "manage" },
  { href: "/app/pengaturan", label: "Pengaturan", icon: Settings, group: "manage" },
  { href: "/app/platform", label: "Admin Platform", icon: ShieldCheck, perm: "platform.manage", group: "system" },
];

export function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}
