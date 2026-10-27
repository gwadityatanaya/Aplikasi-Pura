"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCheck, FileUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import { formatDate, rupiah } from "@/lib/format";
import type { Donation } from "@/lib/types";

/** Splits CSV text into rows. Handles quotes and , ; or tab separators. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const sep = [";", "\t", ","].map((s) => [s, firstLine.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell.trim()); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((x) => x)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x)) rows.push(row);
  return rows;
}

/**
 * "1.250.000,00", "1,250,000.00", "Rp 150.000 CR" → 1250000 / 150000.
 * Money going out ("-50.000", "50.000 DB") and unreadable cells give 0.
 */
export function parseAmount(s: string): number {
  if (/-\s*\d|\bD[BR]\b/i.test(s) && !/\bCR\b/i.test(s)) return 0;
  let t = s.replace(/[^\d.,]/g, "");
  if (!t) return 0;
  const lastSep = Math.max(t.lastIndexOf("."), t.lastIndexOf(","));
  const decimals = t.length - lastSep - 1;
  if (lastSep >= 0 && decimals > 0 && decimals <= 2) t = t.slice(0, lastSep); // drop cents
  return Math.round(Number(t.replace(/[.,]/g, "")) || 0);
}

/** dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd, "05 Okt 2026" → yyyy-mm-dd, or "" when unreadable. */
export function parseDate(s: string): string {
  const months: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
  const pad = (n: number) => String(n).padStart(2, "0");
  const t = s.trim().toLowerCase();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  m = t.match(/^(\d{1,2})[\s-]([a-z]{3})[a-z]*[\s-](\d{2,4})/);
  if (m && months[m[2]]) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${pad(months[m[2]])}-${pad(+m[1])}`;
  return "";
}

const guess = (head: string[], words: RegExp) => Math.max(0, head.findIndex((h) => words.test(h.toLowerCase())));
const dayDiff = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400_000);

/**
 * Bank statement (mutasi) CSV → marks pending punia whose amount matches a credit within 2 days.
 * Everything happens on this device; the statement itself is never uploaded or stored.
 */
export function MutasiImport({ open, onClose, pending, isOwn }: { open: boolean; onClose: () => void; pending: Donation[]; isOwn: (d: Donation) => boolean }) {
  const verify = useStore((s) => s.verifyPunia);
  const [rows, setRows] = useState<string[][]>([]);
  const [dateCol, setDateCol] = useState(0);
  const [amountCol, setAmountCol] = useState(0);
  const [busy, setBusy] = useState(false);

  async function load(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) return toast.error("File terlalu besar (maks. 2 MB).");
    const r = parseCsv(await file.text());
    if (r.length < 2) return toast.error("File CSV kosong atau tidak terbaca.");
    const headIdx = Math.max(0, r.findIndex((x) => x.some((c) => /tanggal|tgl|date/i.test(c))));
    const body = r.slice(headIdx);
    setRows(body);
    setDateCol(guess(body[0], /tanggal|tgl|date/));
    setAmountCol(guess(body[0], /kredit|credit|cr\b|masuk|jumlah|nominal|amount|mutasi/));
  }

  const credits = useMemo(
    () => rows.slice(1).map((r) => ({ date: parseDate(r[dateCol] ?? ""), amount: parseAmount(r[amountCol] ?? ""), raw: r.join(" · ") })).filter((c) => c.date && c.amount > 0),
    [rows, dateCol, amountCol]
  );
  const matches = useMemo(() => {
    const used = new Set<number>();
    const out: { d: Donation; credit: (typeof credits)[number] }[] = [];
    for (const d of pending) {
      const i = credits.findIndex((c, k) => !used.has(k) && c.amount === d.amount && dayDiff(c.date, d.transferDate ?? d.date) <= 2);
      if (i >= 0) { used.add(i); out.push({ d, credit: credits[i] }); }
    }
    return out;
  }, [pending, credits]);
  const approvable = matches.filter((m) => !isOwn(m.d));

  async function approve() {
    setBusy(true);
    const r = await verify(approvable.map((m) => m.d.id));
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(`${r.value.verified} punia disetujui.`);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cocokkan dengan mutasi rekening"
      description="Unggah file CSV mutasi dari internet banking. File hanya dibaca di perangkat ini dan tidak disimpan."
      footer={approvable.length > 0 && <Button size="lg" className="w-full" loading={busy} onClick={approve}><CheckCheck className="h-5 w-5" /> Setujui {approvable.length} punia yang cocok</Button>}
    >
      <div className="space-y-4">
        <label className="press flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-5 font-semibold text-emerald-800 hover:border-emerald-400">
          <FileUp className="h-5 w-5" /> Pilih file CSV mutasi
          <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => load(e.target.files?.[0])} />
        </label>
        {rows.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kolom tanggal" htmlFor="mx-date"><Select id="mx-date" value={dateCol} onChange={(e) => setDateCol(+e.target.value)}>{rows[0].map((h, i) => <option key={i} value={i}>{h || `Kolom ${i + 1}`}</option>)}</Select></Field>
              <Field label="Kolom uang masuk" htmlFor="mx-amt"><Select id="mx-amt" value={amountCol} onChange={(e) => setAmountCol(+e.target.value)}>{rows[0].map((h, i) => <option key={i} value={i}>{h || `Kolom ${i + 1}`}</option>)}</Select></Field>
            </div>
            <p className="text-sm text-muted">{credits.length} baris uang masuk terbaca · {matches.length} dari {pending.length} punia menunggu cocok (nominal sama, tanggal selisih ≤ 2 hari).</p>
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {pending.map((d) => {
                const m = matches.find((x) => x.d.id === d.id);
                return (
                  <li key={d.id} className="flex items-center gap-3 p-3 text-[15px]">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{rupiah(d.amount)} · {d.donorName}</p>
                      <p className="truncate text-sm text-muted">{formatDate(d.transferDate ?? d.date)}{m ? ` ↔ mutasi ${formatDate(m.credit.date)}` : ""}</p>
                    </div>
                    {m ? (isOwn(d) ? <Badge tone="violet">Punia Anda</Badge> : <Badge tone="green">Cocok</Badge>) : <Badge tone="amber">Belum ditemukan</Badge>}
                  </li>
                );
              })}
            </ul>
            <p className="text-sm text-muted">Tetap periksa nama pengirim di mutasi. Punia yang belum ditemukan bisa jadi belum masuk atau tanggalnya berbeda.</p>
          </>
        )}
      </div>
    </Dialog>
  );
}
