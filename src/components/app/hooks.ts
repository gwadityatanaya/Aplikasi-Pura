"use client";
import { useMemo } from "react";
import { useStore, useRole } from "@/lib/store";
import { can, type Permission } from "@/lib/permissions";

export function useCan() {
  const role = useRole();
  return (p: Permission) => can(role, p);
}

/** All data for the active temple workspace. Derived with useMemo (stable references). */
export function useWorkspace() {
  const data = useStore((s) => s.data);
  const templeId = useStore((s) => s.session?.activeTempleId ?? "");
  return useMemo(() => {
    const temple = data.temples.find((t) => t.id === templeId);
    return {
      templeId,
      temple,
      data,
      transactions: data.transactions.filter((t) => t.templeId === templeId),
      accounts: data.accounts.filter((a) => a.templeId === templeId),
      categories: data.categories.filter((c) => c.templeId === templeId),
      activities: data.activities.filter((a) => a.templeId === templeId),
      campaigns: data.campaigns.filter((c) => c.templeId === templeId),
      donations: data.donations.filter((d) => d.templeId === templeId),
      reports: data.reports.filter((r) => r.templeId === templeId),
      notifications: data.notifications.filter((n) => n.templeId === templeId),
      audit: data.audit.filter((a) => a.templeId === templeId),
      users: data.users,
      memberships: data.memberships.filter((m) => m.templeId === templeId),
    };
  }, [data, templeId]);
}
