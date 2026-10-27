"use client";
import { useEffect } from "react";
import { useStore } from "./store";

/** Public data from /api/public — only what each temple has chosen to show. */
export function usePublicData() {
  const publicData = useStore((s) => s.publicData);
  const loadPublic = useStore((s) => s.loadPublic);
  useEffect(() => {
    loadPublic(true);
  }, [loadPublic]);
  const p = publicData ?? { temples: [], banjars: [], campaigns: [], donations: [], reports: [], accounts: [] };
  return { hydrated: !!publicData, ...p };
}
