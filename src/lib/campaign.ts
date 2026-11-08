// Where a penggalangan dana stands — shared by the screens and the server.
import type { Campaign } from "./types";
import { todayISO } from "./format";

export type CampaignPhase = "draft" | "active" | "ended" | "closed";

/**
 * draft  — not published yet
 * active — receiving punia
 * ended  — its end date has passed ("Berakhir")
 * closed — closed early by the pengurus, with a public reason ("Ditutup"); also older campaigns
 *          that were marked "completed" before closing needed a reason.
 */
export function campaignPhase(c: Pick<Campaign, "status" | "endDate" | "closedAt">, today: string): CampaignPhase {
  if (c.status === "draft") return "draft";
  if (c.closedAt || c.status === "completed") return "closed";
  if (c.endDate && c.endDate < today) return "ended";
  return "active";
}

export const PHASE_LABEL: Record<CampaignPhase, string> = { draft: "Draf", active: "Aktif", ended: "Berakhir", closed: "Ditutup" };

/** A target of 0 means "no target": no progress bar and no percentage anywhere. */
export const hasTarget = (c: Pick<Campaign, "target">) => c.target > 0;

/** Still receiving punia today (published, not closed, end date not passed). */
export const campaignOpen = (c: Pick<Campaign, "status" | "endDate" | "closedAt">, today = todayISO()) => campaignPhase(c, today) === "active";
