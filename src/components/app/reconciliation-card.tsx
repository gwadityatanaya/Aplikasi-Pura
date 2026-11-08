"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Scale, TriangleAlert } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { useWorkspace } from "@/components/app/hooks";
import { useStore } from "@/lib/store";
import { accountBalance } from "@/lib/ledger";
import { formatDate, formatDateTime, rupiah, todayISO } from "@/lib/format";
import { latestReconciliations, monthEnd, monthLabel } from "@/lib/reconciliation";

const prevMonth = () => {
  const d = new Date(`${todayISO().slice(0, 7)}-15T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
};

function Diff({ v }: { v: number }) {
  if (v === 0) return <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Cocok</Badge>;
  return <Badge tone="red"><TriangleAlert className="h-3 w-3" /> Selisih {v > 0 ? "+" : "−"}{rupiah(Math.abs(v))}</Badge>;
}

/**
 * Pencocokan saldo bulanan: the end-of-month balance from the bank statement and the cash count,
 * next to the app's own balance. Only a note — it never changes any balance.
 */
export function ReconciliationCard({ canEdit }: { canEdit: boolean }) {
  const ws = useWorkspace();
  const run = useStore((s) => s.run);
  const [month, setMonth] = useState(prevMonth());
  const [vals, setVals] = useState<Record<string, number | undefined>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const end = monthEnd(month);
  const start = ws.temple?.booksStartDate;
  const accounts = ws.accounts.filter((a) => !a.archived || ws.transactions.some((t) => t.accountId === a.id || t.toAccountId === a.id));
  const app = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, accountBalance(a, ws.transactions, end)])), [accounts, ws.transactions, end]);
  const history = latestReconciliations(ws.data.reconciliations ?? []).slice(0, 12);
  const filled = accounts.filter((a) => vals[a.id] !== undefined);
  const tooEarly = !!start && end < start;

  async function save() {
    setBusy(true);
    const r = await run("saveReconciliation", { month, items: filled.map((a) => ({ accountId: a.id, statementBalance: vals[a.id]!, note: notes[a.id] || undefined })) });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(`Pencocokan ${monthLabel(month)} dicatat`);
    setVals({});
    setNotes({});
  }

  return (
    <Card className="mt-4">
      <CardHeader title="Pencocokan saldo bulanan" description="Setiap akhir bulan: isi saldo dari mutasi bank dan hasil hitung kas tunai. Aplikasi menunjukkan selisihnya. Ini hanya catatan — saldo tidak berubah." />
      <CardBody className="space-y-4">
        {canEdit && (
          <>
            <Field label="Bulan" htmlFor="rk-month" hint={`Saldo aplikasi dihitung sampai ${formatDate(end)}.`}>
              <Input id="rk-month" type="month" max={todayISO().slice(0, 7)} value={month} onChange={(e) => setMonth(e.target.value)} />
            </Field>
            {tooEarly && <p className="text-sm font-semibold text-amber-800">Bulan itu sebelum tanggal mulai pembukuan.</p>}
            <ul className="space-y-3" aria-label="Isian pencocokan">
              {accounts.map((a) => {
                const v = vals[a.id];
                return (
                  <li key={a.id} className="rounded-2xl border border-line p-3">
                    <p className="font-bold">{a.label || a.name}{a.archived ? " (nonaktif)" : ""}</p>
                    <p className="text-sm text-muted">Saldo menurut aplikasi: <b className="tabular text-charcoal">{rupiah(app[a.id])}</b></p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Field label={a.type === "cash" ? "Hasil hitung uang tunai" : "Saldo akhir di mutasi bank"}>
                        <MoneyInput value={v ?? 0} onChange={(x) => setVals({ ...vals, [a.id]: x })} />
                      </Field>
                      <Field label="Catatan (opsional)" htmlFor={`rk-note-${a.id}`}>
                        <Input id={`rk-note-${a.id}`} value={notes[a.id] ?? ""} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} placeholder="Mis. biaya admin bank belum dicatat" />
                      </Field>
                    </div>
                    {v !== undefined && <div className="mt-2" aria-live="polite"><Diff v={v - app[a.id]} /></div>}
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-end">
              <Button disabled={!filled.length || tooEarly} loading={busy} onClick={save}><Scale className="h-4 w-4" /> Simpan pencocokan</Button>
            </div>
          </>
        )}
        {history.length > 0 && (
          <div>
            <p className="mb-2 font-bold">Hasil pencocokan terakhir</p>
            <ul className="divide-y divide-line rounded-2xl border border-line" aria-label="Hasil pencocokan">
              {history.map((r) => {
                const a = ws.accounts.find((x) => x.id === r.accountId);
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 p-3 text-[0.9375rem]">
                    <span className="min-w-0 flex-1">
                      <b>{monthLabel(r.month)}</b> · {a ? a.label || a.name : "—"}
                      <span className="block text-sm text-muted">Aplikasi {rupiah(r.appBalance)} · mutasi/hitungan {rupiah(r.statementBalance)}{r.note ? ` · ${r.note}` : ""} · {r.createdByName ?? ""} {formatDateTime(r.createdAt)}</span>
                    </span>
                    <Diff v={r.statementBalance - r.appBalance} />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
