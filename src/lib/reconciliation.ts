// Monthly check (rekonsiliasi sederhana) — shared by the Laporan page and the printed report.
import type { ReportTable } from "./export";
import type { Account, Reconciliation } from "./types";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
/** Last day of a yyyy-mm month as yyyy-mm-dd. */
export const monthEnd = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10);

/** The latest check per month and account (later checks replace earlier ones; all are kept). */
export function latestReconciliations(recs: Reconciliation[], fromMonth = "0000-00", toMonth = "9999-99") {
  const map = new Map<string, Reconciliation>();
  for (const r of [...recs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) if (r.month >= fromMonth && r.month <= toMonth) map.set(`${r.month}|${r.accountId}`, r);
  return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
}

/** "Pencocokan saldo bulanan" table for the report (printed above the signature block). */
export function reconciliationTable(recs: Reconciliation[], accounts: Account[], from: string, to: string): ReportTable | null {
  const rows = latestReconciliations(recs, from.slice(0, 7), to.slice(0, 7)).reverse();
  if (!rows.length) return null;
  const name = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? a.label || a.name : "—";
  };
  return {
    title: "Pencocokan saldo bulanan (rekonsiliasi)",
    head: ["Bulan", "Kas / rekening", "Saldo menurut aplikasi", "Saldo menurut mutasi / hitungan", "Selisih", "Catatan"],
    body: rows.map((r) => [monthLabel(r.month), name(r.accountId), r.appBalance, r.statementBalance, r.statementBalance - r.appBalance, r.note || (r.statementBalance === r.appBalance ? "Cocok" : "")]),
    money: [2, 3, 4],
  };
}
