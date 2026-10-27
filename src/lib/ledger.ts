// Pure accounting helpers. Balances are ALWAYS derived from opening balances + confirmed
// ledger entries; no stored balance number is ever mutated.
import type { Account, Activity, Campaign, Category, DataState, Donation, Transaction } from "./types";

/** Confirmed entries only. Drafts never affect totals. */
export function confirmed(txs: Transaction[]) {
  return txs.filter((t) => t.status === "confirmed");
}

/** Reversal entries negate the economic effect of the entry they reverse. */
function sign(t: Transaction) {
  return t.reversalOf ? -1 : 1;
}

/** Signed effect of one entry on one account. */
export function accountEffect(t: Transaction, accountId: string) {
  if (t.status !== "confirmed") return 0;
  const s = sign(t);
  if (t.type === "income" && t.accountId === accountId) return s * t.amount;
  if (t.type === "expense" && t.accountId === accountId) return -s * t.amount;
  if (t.type === "transfer") {
    if (t.accountId === accountId) return -s * t.amount;
    if (t.toAccountId === accountId) return s * t.amount;
  }
  return 0;
}

export function accountBalance(account: Account, txs: Transaction[], until?: string) {
  let bal = account.openingBalance;
  for (const t of txs) {
    if (t.templeId !== account.templeId) continue;
    if (until && t.date > until) continue;
    bal += accountEffect(t, account.id);
  }
  return bal;
}

/** Real income (transfers excluded). Reversal entries count negative. */
export function incomeOf(txs: Transaction[]) {
  return confirmed(txs)
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + sign(t) * t.amount, 0);
}

export function expenseOf(txs: Transaction[]) {
  return confirmed(txs)
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + sign(t) * t.amount, 0);
}

export function templeTx(state: Pick<DataState, "transactions">, templeId: string) {
  return state.transactions.filter((t) => t.templeId === templeId);
}

export function templeAccounts(state: Pick<DataState, "accounts">, templeId: string) {
  return state.accounts.filter((a) => a.templeId === templeId);
}

export interface Summary {
  openingBalance: number;
  income: number;
  expense: number;
  net: number;
  closingBalance: number;
  cash: number;
  bank: number;
}

export function summarize(
  state: Pick<DataState, "transactions" | "accounts">,
  templeId: string,
  range?: { from?: string; to?: string; accountId?: string }
): Summary {
  const accounts = templeAccounts(state, templeId).filter((a) => !range?.accountId || a.id === range.accountId);
  const txs = templeTx(state, templeId);
  const from = range?.from;
  const to = range?.to;
  const dayBefore = from ? shiftDay(from, -1) : undefined;
  const openingBalance = accounts.reduce(
    (s, a) => s + (dayBefore ? accountBalance(a, txs, dayBefore) : a.openingBalance),
    0
  );
  const closingBalance = accounts.reduce((s, a) => s + accountBalance(a, txs, to), 0);
  const inRange = txs.filter(
    (t) =>
      (!from || t.date >= from) &&
      (!to || t.date <= to) &&
      (!range?.accountId || t.accountId === range.accountId)
  );
  const income = incomeOf(inRange);
  const expense = expenseOf(inRange);
  const cash = accounts.filter((a) => a.type === "cash").reduce((s, a) => s + accountBalance(a, txs, to), 0);
  const bank = accounts.filter((a) => a.type === "bank").reduce((s, a) => s + accountBalance(a, txs, to), 0);
  return { openingBalance, income, expense, net: income - expense, closingBalance, cash, bank };
}

export function shiftDay(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function byCategory(txs: Transaction[], categories: Category[], type: "income" | "expense") {
  const map = new Map<string, number>();
  for (const t of confirmed(txs)) {
    if (t.type !== type) continue;
    const key = t.categoryId ?? "lain";
    map.set(key, (map.get(key) ?? 0) + sign(t) * t.amount);
  }
  return Array.from(map.entries())
    .map(([id, amount]) => ({ id, name: categories.find((c) => c.id === id)?.name ?? "Lain-lain", amount }))
    .filter((r) => r.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
}

export function activitySummary(activity: Activity, txs: Transaction[]) {
  const rel = txs.filter((t) => t.activityId === activity.id);
  const income = incomeOf(rel);
  const expense = expenseOf(rel);
  return {
    income,
    expense,
    net: income - expense,
    count: confirmed(rel).length,
    budgetUsed: activity.budget ? (expense / activity.budget) * 100 : 0,
  };
}

/** Only verified donations count toward official campaign totals. */
export function campaignStats(campaign: Campaign, donations: Donation[]) {
  const own = donations.filter((d) => d.campaignId === campaign.id);
  const verified = own.filter((d) => d.status === "verified");
  const collected = verified.reduce((s, d) => s + d.amount, 0);
  return {
    collected,
    contributors: verified.length,
    pending: own.filter((d) => d.status === "pending"),
    pendingAmount: own.filter((d) => d.status === "pending").reduce((s, d) => s + d.amount, 0),
    progress: campaign.target ? Math.min(100, (collected / campaign.target) * 100) : 0,
    verified,
  };
}

export type Period = "weekly" | "monthly" | "yearly";

/** Cash-flow series for the dashboard chart. */
export function flowSeries(txs: Transaction[], period: Period, today: string) {
  const conf = confirmed(txs).filter((t) => t.type !== "transfer");
  const [ty, tm, td] = today.split("-").map(Number);
  const buckets: { key: string; label: string; from: string; to: string }[] = [];
  if (period === "weekly") {
    // last 8 weeks
    for (let i = 7; i >= 0; i--) {
      const end = new Date(ty, tm - 1, td - i * 7);
      const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
      buckets.push({
        key: `w${i}`,
        label: end.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        from: iso(start),
        to: iso(end),
      });
    }
  } else if (period === "monthly") {
    for (let i = 11; i >= 0; i--) {
      const start = new Date(ty, tm - 1 - i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      buckets.push({
        key: `m${i}`,
        label: start.toLocaleDateString("id-ID", { month: "short" }),
        from: iso(start),
        to: iso(end),
      });
    }
  } else {
    for (let i = 4; i >= 0; i--) {
      const y = ty - i;
      buckets.push({ key: `y${y}`, label: String(y), from: `${y}-01-01`, to: `${y}-12-31` });
    }
  }
  return buckets.map((b) => {
    const r = conf.filter((t) => t.date >= b.from && t.date <= b.to);
    const income = incomeOf(r);
    const expense = expenseOf(r);
    return { label: b.label, from: b.from, to: b.to, income, expense, net: income - expense };
  });
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monthly cash-flow table: opening, in, out, closing per month. */
export function monthlyCashflow(
  state: Pick<DataState, "transactions" | "accounts">,
  templeId: string,
  from: string,
  to: string
) {
  const rows: { month: string; from: string; to: string; opening: number; income: number; expense: number; closing: number }[] = [];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const endD = new Date(y, m, 0);
    const end = iso(endD) > to ? to : iso(endD);
    const s = summarize(state, templeId, { from: start < from ? from : start, to: end });
    rows.push({
      month: new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
      from: start,
      to: end,
      opening: s.openingBalance,
      income: s.income,
      expense: s.expense,
      closing: s.closingBalance,
    });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return rows;
}
