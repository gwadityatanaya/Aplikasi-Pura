import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "./db";
import * as m from "./map";
import type { Account, Campaign, Donation, PublishedReport, Temple } from "@/lib/types";

export interface PublicData {
  temples: Temple[];
  campaigns: Campaign[];
  donations: Donation[];
  reports: PublishedReport[];
  accounts: Account[];
}

/**
 * Only information each temple has chosen to publish. Private donors are merged into one
 * row per campaign (no individual amounts), and evidence/messages are never included.
 */
export async function loadPublic(): Promise<PublicData> {
  const templeRows = await db.select().from(schema.temples).where(eq(schema.temples.status, "active"));
  const temples = templeRows.map(m.toTemple).filter((t) => t.transparency.showPublicProfile);
  const ids = temples.map((t) => t.id);
  if (!ids.length) return { temples: [], campaigns: [], donations: [], reports: [], accounts: [] };
  const byId = new Map(temples.map((t) => [t.id, t]));

  const [campRows, reportRows, accRows] = await Promise.all([
    db.select().from(schema.campaigns).where(and(inArray(schema.campaigns.templeId, ids), ne(schema.campaigns.status, "draft"))),
    db.select().from(schema.reports).where(inArray(schema.reports.templeId, ids)),
    db.select().from(schema.accounts).where(and(inArray(schema.accounts.templeId, ids), eq(schema.accounts.type, "bank"))),
  ]);
  const campaigns = campRows.map(m.toCampaign).filter((c) => byId.get(c.templeId)?.transparency.showCampaigns);
  const campIds = campaigns.map((c) => c.id);
  const donRows = campIds.length
    ? await db.select().from(schema.donations).where(and(inArray(schema.donations.campaignId, campIds), eq(schema.donations.status, "verified")))
    : [];

  const donations: Donation[] = [];
  const privateAgg = new Map<string, Donation>();
  for (const r of donRows) {
    const c = campaigns.find((x) => x.id === r.campaignId)!;
    const showNames = c.showDonorList && byId.get(c.templeId)!.transparency.showDonorList;
    const base: Donation = {
      id: r.id, templeId: r.templeId, campaignId: r.campaignId, donorName: "", amount: r.amount, date: r.date,
      privacy: r.privacy as Donation["privacy"], status: "verified", channel: "transfer", createdAt: r.createdAt.toISOString(),
      verifiedAt: r.verifiedAt?.toISOString(),
    };
    if (r.privacy === "private" || !showNames) {
      const agg = privateAgg.get(r.campaignId);
      if (agg) {
        agg.amount += r.amount;
        agg.count = (agg.count ?? 1) + 1;
        if (r.date > agg.date) agg.date = r.date;
      } else privateAgg.set(r.campaignId, { ...base, id: `private_${r.campaignId}`, privacy: "private", count: 1, verifiedAt: undefined });
      continue;
    }
    donations.push({ ...base, donorName: r.privacy === "public" ? r.donorName : "Anonim" });
  }
  donations.push(...Array.from(privateAgg.values()));

  const reports = reportRows.map(m.toReport).filter((r) => byId.get(r.templeId)?.transparency.showPublishedSummaries);
  const usedByCampaign = new Set(campaigns.filter((c) => c.status === "active").map((c) => c.accountId));
  const accounts = accRows
    .filter((a) => byId.get(a.templeId)?.transparency.showBankAccount && (a.isPublic || usedByCampaign.has(a.id)))
    .map((a) => ({ ...m.toAccount(a), openingBalance: 0 }));

  return { temples, campaigns, donations, reports, accounts };
}
