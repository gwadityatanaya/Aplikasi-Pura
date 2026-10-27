import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "./db";
import * as m from "./map";
import { summarize } from "@/lib/ledger";
import type { Banjar, Campaign, Donation, PublishedReport, Temple } from "@/lib/types";

export interface PublicTx {
  id: string;
  date: string;
  type: "income" | "expense";
  description: string;
  category: string;
  /** Positive for income, negative for expense (corrections flip the sign) */
  amount: number;
}

export interface PublicTemple extends Temple {
  banjarNames: string[];
  hasPengurus: boolean;
  acceptsPunia: boolean;
  /** Present only when the temple shows its cash position */
  balance?: number;
  balanceAsOf?: string;
  recentTransactions?: PublicTx[];
}

export interface PublicData {
  temples: PublicTemple[];
  banjars: Banjar[];
  campaigns: Campaign[];
  donations: Donation[];
  reports: PublishedReport[];
  accounts: never[];
}

/**
 * Only information each temple has chosen to show. This is the ONLY place public data is built:
 * real names of anonymous donors, emails, messages, proofs and internal notes are never included.
 */
export async function loadPublic(): Promise<PublicData> {
  const templeRows = await db.select().from(schema.temples).where(eq(schema.temples.status, "active"));
  const base = templeRows.map(m.toTemple).filter((t) => t.transparency.showPublicProfile);
  const ids = base.map((t) => t.id);
  if (!ids.length) return { temples: [], banjars: [], campaigns: [], donations: [], reports: [], accounts: [] };

  const [tb, banjarRows, pengurus, campRows, reportRows, donRows, txRows, accRows, catRows] = await Promise.all([
    db.select().from(schema.templeBanjars).where(inArray(schema.templeBanjars.templeId, ids)),
    db.select().from(schema.banjars).where(eq(schema.banjars.status, "active")),
    db.select({ templeId: schema.memberships.templeId }).from(schema.memberships).where(and(inArray(schema.memberships.templeId, ids), eq(schema.memberships.role, "pengurus"), eq(schema.memberships.status, "active"))),
    db.select().from(schema.campaigns).where(and(inArray(schema.campaigns.templeId, ids), ne(schema.campaigns.status, "draft"))),
    db.select().from(schema.reports).where(inArray(schema.reports.templeId, ids)),
    db.select().from(schema.donations).where(and(inArray(schema.donations.templeId, ids), eq(schema.donations.status, "verified"))),
    db.select().from(schema.transactions).where(and(inArray(schema.transactions.templeId, ids), eq(schema.transactions.status, "confirmed"))),
    db.select().from(schema.accounts).where(inArray(schema.accounts.templeId, ids)),
    db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories).where(inArray(schema.categories.templeId, ids)),
  ]);
  const catName = new Map(catRows.map((c) => [c.id, c.name]));
  const txs = txRows.map(m.toTx);
  const accounts = accRows.map(m.toAccount);

  const temples: PublicTemple[] = base.map((t) => {
    const banjarIds = tb.filter((r) => r.templeId === t.id).map((r) => r.banjarId);
    const tp = t.transparency;
    const out: PublicTemple = {
      ...t,
      email: t.email,
      banjarIds,
      banjarNames: banjarRows.filter((b) => banjarIds.includes(b.id)).map((b) => b.name),
      pengurusCount: undefined,
      hasPengurus: pengurus.some((p) => p.templeId === t.id),
      acceptsPunia: !!(t.bankName && t.bankAccountNumber && t.bankAccountHolder),
    };
    const own = txs.filter((x) => x.templeId === t.id);
    if (tp.showBalance !== false) {
      out.balance = summarize({ transactions: own, accounts: accounts.filter((a) => a.templeId === t.id) }, t.id).closingBalance;
      out.balanceAsOf = own.reduce((d, x) => (x.date > d ? x.date : d), "");
    }
    if (tp.showRecentTransactions !== false) {
      const n = Math.min(5, Math.max(3, tp.recentCount ?? 5));
      out.recentTransactions = own
        .filter((x) => x.type !== "transfer")
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, n)
        .map((x) => ({
          id: x.id,
          date: x.date,
          type: x.type as "income" | "expense",
          description: x.reversalOf ? `Koreksi: ${x.description.replace(/^Koreksi:\s*/, "")}` : x.description,
          category: catName.get(x.categoryId ?? "") ?? "",
          amount: (x.type === "income" ? 1 : -1) * (x.reversalOf ? -x.amount : x.amount),
        }));
    }
    return out;
  });
  const byId = new Map(temples.map((t) => [t.id, t]));
  const campaigns = campRows.map(m.toCampaign).filter((c) => byId.get(c.templeId)?.transparency.showCampaigns);

  // Punia: only verified ones. Anonymous donors are renamed HERE, on the server.
  const donations: Donation[] = [];
  const hidden = new Map<string, Donation>();
  for (const r of donRows) {
    const t = byId.get(r.templeId);
    if (!t) continue;
    const c = r.campaignId ? campaigns.find((x) => x.id === r.campaignId) : undefined;
    if (r.campaignId && !c) continue;
    const listVisible = t.transparency.showDonorList && (!c || c.showDonorList);
    const base: Donation = {
      id: r.id, templeId: r.templeId, campaignId: r.campaignId ?? undefined, purpose: (r.purpose as Donation["purpose"]) ?? "umum", donorName: "",
      amount: r.amount, date: r.transferDate ?? r.date, privacy: r.privacy as Donation["privacy"], status: "verified", channel: "transfer",
      createdAt: r.createdAt.toISOString(), verifiedAt: r.verifiedAt?.toISOString(),
    };
    if (r.privacy === "private" || !listVisible) {
      // Counted in totals only: one combined row per temple/campaign, no names or individual amounts.
      const key = `${r.templeId}|${r.campaignId ?? ""}`;
      const agg = hidden.get(key);
      if (agg) {
        agg.amount += r.amount;
        agg.count = (agg.count ?? 1) + 1;
      } else hidden.set(key, { ...base, id: `private_${key}`, privacy: "private", count: 1, verifiedAt: undefined });
      continue;
    }
    donations.push({ ...base, donorName: r.privacy === "public" ? r.donorName : "Anonim" });
  }
  donations.push(...Array.from(hidden.values()));

  const reports = reportRows.map(m.toReport).filter((r) => byId.get(r.templeId)?.transparency.showPublishedSummaries);
  return { temples, banjars: banjarRows.map(m.toBanjar), campaigns, donations, reports, accounts: [] };
}
