"use client";
import { useMemo } from "react";
import { useStore } from "./store";

/** Public selectors: only data explicitly allowed by each temple's transparency settings. */
export function usePublicData() {
  const data = useStore((s) => s.data);
  const hydrated = useStore((s) => s.hydrated);
  return useMemo(() => {
    const temples = data.temples.filter((t) => t.status === "active" && t.transparency.showPublicProfile);
    const visibleTempleIds = new Set(temples.filter((t) => t.transparency.showCampaigns).map((t) => t.id));
    const campaigns = data.campaigns.filter((c) => c.status !== "draft" && visibleTempleIds.has(c.templeId));
    // Public pages receive donations stripped of evidence images.
    const donations = data.donations.map(({ evidence: _e, ...d }) => d);
    return { hydrated, temples, campaigns, donations, reports: data.reports, accounts: data.accounts };
  }, [data, hydrated]);
}
