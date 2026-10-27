import { AppShell } from "@/components/app/app-shell";

export const metadata = { title: "Dashboard Pengurus" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
