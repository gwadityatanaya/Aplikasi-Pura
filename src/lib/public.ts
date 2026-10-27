"use client";
import { useEffect, useMemo } from "react";
import { useStore } from "./store";

/**
 * Public data. Normal mode: fetched from /api/public, which only returns what each temple
 * has chosen to publish. Demo mode: derived from the demo data in this browser.
 */
export function usePublicData() {
  const mode = useStore((s) => s.mode);
  const publicData = useStore((s) => s.publicData);
  const data = useStore((s) => s.data);
  const hydrated = useStore((s) => s.hydrated);
  const loadPublic = useStore((s) => s.loadPublic);
  useEffect(() => {
    if (hydrated && mode === "server") loadPublic(true);
  }, [hydrated, mode, loadPublic]);

  return useMemo(() => {
    if (mode === "server") {
      const p = publicData ?? { temples: [], campaigns: [], donations: [], reports: [], accounts: [] };
      return { hydrated: hydrated && !!publicData, ...p };
    }
    const temples = data.temples.filter((t) => t.status === "active" && t.transparency.showPublicProfile);
    const visibleTempleIds = new Set(temples.filter((t) => t.transparency.showCampaigns).map((t) => t.id));
    const campaigns = data.campaigns.filter((c) => c.status !== "draft" && visibleTempleIds.has(c.templeId));
    const donations = data.donations.map(({ evidence: _e, ...d }) => d);
    return { hydrated, temples, campaigns, donations, reports: data.reports, accounts: data.accounts };
  }, [mode, publicData, data, hydrated]);
}
