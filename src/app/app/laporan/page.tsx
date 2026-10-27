"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, FileSpreadsheet, FileText, Globe, Presentation, Share2, SlidersHorizontal, Table2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, NoAccess } from "@/components/app/page-header";
import { useCan, useWorkspace } from "@/components/app/hooks";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Badge } from "@/components/ui/badge";
import { ChartLegend, CategoryBars, FlowChart } from "@/components/shared/charts";
import { WhatsAppIcon, whatsappLink } from "@/components/shared/share";
import { OrnamentDivider } from "@/components/brand/ornament";
import { buildReport, filterTx, REPORT_TYPES, whatsappSummary, type ReportFilters } from "@/lib/reports";
import { exportCsv, exportPdf, exportXlsx, sharePdfFile } from "@/lib/export";
import { byCategory, monthlyCashflow } from "@/lib/ledger";
import { useStore } from "@/lib/store";
import { cn, formatDateShort, rupiah, todayISO } from "@/lib/format";

function presetRange(p: string): [string, string] {
  const t = todayISO();
  const [y, m] = t.split("-").map(Number);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  switch (p) {
    case "bulan-ini": return [iso(new Date(y, m - 1, 1)), t];
    case "bulan-lalu": return [iso(new Date(y, m - 2, 1)), iso(new Date(y, m - 1, 0))];
    case "triwulan": { const q = Math.floor((m - 1) / 3) * 3; return [iso(new Date(y, q, 1)), t]; }
    case "triwulan-lalu": { const q = Math.floor((m - 1) / 3) * 3 - 3; return [iso(new Date(y, q, 1)), iso(new Date(y, q + 3, 0))]; }
    case "semester": return m <= 6 ? [`${y}-01-01`, t] : [`${y}-07-01`, t];
    default: return [`${y}-01-01`, t];
  }
}
const PRESETS = [
  ["bulan-ini", "Bulan ini"],
  ["bulan-lalu", "Bulan lalu"],
  ["triwulan", "Triwulan ini"],
  ["triwulan-lalu", "Triwulan lalu"],
  ["tahun-ini", "Tahun ini"],
] as const;

function Reports() {
  const params = useSearchParams();
  const ws = useWorkspace();
  const can = useCan();
  const publish = useStore((s) => s.publishReport);
  const unpublish = useStore((s) => s.unpublishReport);
  const initialPreset = params.get("preset") ?? "tahun-ini";
  const [preset, setPreset] = useState<string>(initialPreset);
  const [from0, to0] = presetRange(initialPreset);
  const [f, setF] = useState<ReportFilters>({ type: "summary", from: from0, to: to0, txType: "", categoryId: "", activityId: "", campaignId: "", accountId: "", status: "confirmed" });
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [wa, setWa] = useState(false);
  const [waText, setWaText] = useState("");
  const [pub, setPub] = useState({ open: false, title: "", note: "" });
  const [unpub, setUnpub] = useState<string | null>(null);

  const doc = useMemo(() => (ws.temple ? buildReport(ws, f) : null), [ws, f]);
  const rows = useMemo(() => filterTx(ws, f), [ws, f]);
  const monthly = useMemo(() => monthlyCashflow(ws.data, ws.templeId, f.from, f.to).map((r) => ({ label: r.month.split(" ")[0].slice(0, 3), income: r.income, expense: r.expense })), [ws, f.from, f.to]);

  if (!can("report.view")) return <NoAccess what="laporan" />;
  if (!doc) return null;

  const set = <K extends keyof ReportFilters>(k: K, v: ReportFilters[K]) => setF((p) => ({ ...p, [k]: v }));
  const invalid = f.from > f.to;
  async function run(kind: "pdf" | "xlsx" | "csv") {
    if (!doc || invalid) return;
    setBusy(kind);
    try {
      if (kind === "pdf") await exportPdf(doc);
      if (kind === "xlsx") await exportXlsx(doc);
      if (kind === "csv") exportCsv(doc);
      toast.success(`Laporan ${kind.toUpperCase()} diunduh`);
    } catch (e) {
      toast.error("Gagal membuat file", { description: String(e) });
    } finally {
      setBusy(null);
    }
  }
  const advancedCount = [f.txType, f.categoryId, f.activityId, f.campaignId, f.accountId, f.status !== "confirmed" ? "x" : ""].filter(Boolean).length;
  const presentHref = `/app/presentasi?from=${f.from}&to=${f.to}`;

  return (
    <div>
      <PageHeader
        title="Laporan Keuangan"
        description="Laporan tersusun otomatis dari catatan transaksi. Pilih jenis dan periode, lalu unduh atau bagikan."
        actions={<Link href={presentHref} className={buttonClass("outline")}><Presentation className="h-4 w-4" /> Mode presentasi</Link>}
      />

      <Card className="p-4 md:p-5">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Field label="Jenis laporan" htmlFor="r-type">
            <Select id="r-type" value={f.type} onChange={(e) => set("type", e.target.value as ReportFilters["type"])}>
              {REPORT_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dari" htmlFor="r-from" error={invalid ? "Tanggal awal setelah tanggal akhir" : undefined}><Input id="r-from" type="date" value={f.from} onChange={(e) => { set("from", e.target.value); setPreset(""); }} /></Field>
            <Field label="Sampai" htmlFor="r-to"><Input id="r-to" type="date" value={f.to} onChange={(e) => { set("to", e.target.value); setPreset(""); }} /></Field>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {PRESETS.map(([k, l]) => (
            <button key={k} onClick={() => { const [a, b] = presetRange(k); setF((p) => ({ ...p, from: a, to: b })); setPreset(k); }} className={cn("press rounded-full border px-3.5 py-1.5 text-sm font-semibold", preset === k ? "border-emerald-600 bg-emerald-600 text-white" : "border-line bg-white hover:border-emerald-300")}>
              {l}
            </button>
          ))}
          <Select aria-label="Pilih bulan" className="h-9 w-auto rounded-full py-0 pr-9 text-sm font-semibold" value="" onChange={(e) => { if (!e.target.value) return; const [y, m] = e.target.value.split("-").map(Number); const end = new Date(y, m, 0).getDate(); setF((p) => ({ ...p, from: `${e.target.value}-01`, to: `${e.target.value}-${String(end).padStart(2, "0")}` })); setPreset(""); }}>
            <option value="">Pilih bulan…</option>
            {Array.from({ length: 12 }).map((_, i) => { const d = new Date(Number(todayISO().slice(0, 4)), Number(todayISO().slice(5, 7)) - 1 - i, 1); const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; return <option key={v} value={v}>{d.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</option>; })}
          </Select>
          <button onClick={() => setMore((v) => !v)} className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-mint" aria-expanded={more}>
            <SlidersHorizontal className="h-4 w-4" /> Filter lanjutan {advancedCount > 0 && `(${advancedCount})`}
          </button>
        </div>
        {more && (
          <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Jenis transaksi" htmlFor="r-tx"><Select id="r-tx" value={f.txType} onChange={(e) => set("txType", e.target.value as ReportFilters["txType"])}><option value="">Semua</option><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option><option value="transfer">Pindah dana</option></Select></Field>
            <Field label="Kategori" htmlFor="r-cat"><Select id="r-cat" value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}><option value="">Semua</option>{ws.categories.map((c) => <option key={c.id} value={c.id}>{c.type === "income" ? "↓ " : "↑ "}{c.name}</option>)}</Select></Field>
            <Field label="Kegiatan" htmlFor="r-act"><Select id="r-act" value={f.activityId} onChange={(e) => set("activityId", e.target.value)}><option value="">Semua</option>{ws.activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
            <Field label="Campaign" htmlFor="r-cp"><Select id="r-cp" value={f.campaignId} onChange={(e) => set("campaignId", e.target.value)}><option value="">Semua</option>{ws.campaigns.filter((c) => c.status !== "draft").map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>
            <Field label="Kas / rekening" htmlFor="r-acc"><Select id="r-acc" value={f.accountId} onChange={(e) => set("accountId", e.target.value)}><option value="">Semua</option>{ws.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
            <Field label="Status transaksi" htmlFor="r-st"><Select id="r-st" value={f.status} onChange={(e) => set("status", e.target.value as ReportFilters["status"])}><option value="confirmed">Hanya terkonfirmasi</option><option value="all">Termasuk draf</option><option value="draft">Hanya draf</option></Select></Field>
          </div>
        )}
      </Card>

      <div className="sticky top-16 z-20 -mx-4 mt-4 border-b border-line/60 bg-ivory/90 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <Button onClick={() => run("pdf")} loading={busy === "pdf"} disabled={invalid}><FileText className="h-4 w-4" /> PDF</Button>
          <Button variant="outline" onClick={() => run("xlsx")} loading={busy === "xlsx"} disabled={invalid}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
          <Button variant="outline" onClick={() => run("csv")} loading={busy === "csv"} disabled={invalid}><Table2 className="h-4 w-4" /> CSV</Button>
          <button onClick={() => { setWaText(whatsappSummary(ws, f)); setWa(true); }} disabled={invalid} className="press inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#1FAF55] px-4 text-[15px] font-semibold text-white hover:bg-[#199a4a] disabled:opacity-50">
            <WhatsAppIcon className="h-5 w-5" /> WhatsApp
          </button>
          {can("report.publish") && <Button variant="gold" onClick={() => setPub({ open: true, title: `Laporan Keuangan ${formatDateShort(f.from)} – ${formatDateShort(f.to)}`, note: "" })} disabled={invalid}><Globe className="h-4 w-4" /> Publikasikan</Button>}
        </div>
      </div>

      {/* PREVIEW */}
      <div data-tour="report-preview" className="mt-5 overflow-hidden rounded-3xl border border-line bg-white shadow-soft">
        <div className="relative bg-forest px-6 py-6 text-white">
          <p className="text-xs font-bold uppercase tracking-wider text-gold">Pratinjau laporan</p>
          <h2 className="mt-1 text-xl font-extrabold md:text-2xl">{doc.title}</h2>
          <p className="text-sm text-white/75">{doc.templeName} · {doc.period}</p>
        </div>
        <div className="h-1 bg-gold" />
        <div className="p-5 md:p-7">
          <div className={cn("grid gap-3", doc.summary.length >= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
            {doc.summary.map((s) => (
              <div key={s.label} className="rounded-2xl bg-mint/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{s.label}</p>
                <p className="tabular mt-1 text-lg font-extrabold text-charcoal md:text-xl">{rupiah(s.value)}</p>
              </div>
            ))}
          </div>
          {doc.note && <p className="mt-4 rounded-xl bg-ivory p-3 text-sm text-muted">{doc.note}</p>}
          {(f.type === "summary" || f.type === "cashflow") && monthly.length > 1 && (
            <div className="mt-6">
              <div className="flex items-center justify-between"><h3 className="font-bold">Pemasukan & pengeluaran per bulan</h3><ChartLegend /></div>
              <div className="mt-3"><FlowChart data={monthly} height={220} /></div>
            </div>
          )}
          {f.type === "summary" && (
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div><h3 className="mb-3 font-bold">Sumber pemasukan</h3><CategoryBars rows={byCategory(rows, ws.categories, "income")} /></div>
              <div><h3 className="mb-3 font-bold">Penggunaan dana</h3><CategoryBars rows={byCategory(rows, ws.categories, "expense")} tone="expense" /></div>
            </div>
          )}
          {doc.tables.map((t) => (
            <div key={t.title} className="mt-7">
              <h3 className="mb-2 font-bold text-forest">{t.title}</h3>
              <div className="overflow-x-auto rounded-2xl border border-line">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-emerald-700 text-white"><tr>{t.head.map((h, i) => <th key={h + i} className={cn("px-3 py-2.5 font-semibold", t.money?.includes(i) && "text-right")}>{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-line">
                    {t.body.slice(0, 60).map((r, ri) => (
                      <tr key={ri} className="even:bg-ivory/60">{r.map((v, i) => <td key={i} className={cn("px-3 py-2", t.money?.includes(i) && "tabular text-right font-semibold")}>{t.money?.includes(i) && typeof v === "number" ? rupiah(v) : v}</td>)}</tr>
                    ))}
                    {t.body.length === 0 && <tr><td colSpan={t.head.length} className="px-3 py-6 text-center text-muted">Tidak ada data pada periode/filter ini.</td></tr>}
                  </tbody>
                  {t.foot && <tfoot className="bg-gold-light font-bold"><tr>{t.foot.map((v, i) => <td key={i} className={cn("px-3 py-2.5", t.money?.includes(i) && "tabular text-right")}>{t.money?.includes(i) && typeof v === "number" ? rupiah(v) : v}</td>)}</tr></tfoot>}
                </table>
              </div>
              {t.body.length > 60 && <p className="mt-2 text-sm text-muted">Menampilkan 60 dari {t.body.length} baris. Unduh PDF/Excel untuk data lengkap.</p>}
            </div>
          ))}
          <OrnamentDivider className="mt-8" />
          <div className="mt-6 flex justify-end text-right text-sm">
            <div><p className="text-muted">{doc.signatory?.role}</p><p className="mt-10 font-bold">{doc.signatory?.name}</p></div>
          </div>
        </div>
      </div>

      {/* PUBLISHED */}
      <Card className="mt-6">
        <CardHeader title="Laporan yang dipublikasikan" description="Hanya ringkasan ini yang dapat dilihat publik di halaman pura." />
        <CardBody className="divide-y divide-line py-2">
          {ws.reports.length ? ws.reports.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <Globe className="h-5 w-5 text-emerald-700" />
              <div className="min-w-0 flex-1">
                <Link href={`/pura/${ws.temple?.slug}/laporan/${r.id}`} target="_blank" className="font-semibold hover:text-emerald-700">{r.title}</Link>
                <p className="text-sm text-muted">{formatDateShort(r.periodStart)} – {formatDateShort(r.periodEnd)} · saldo akhir {rupiah(r.snapshot.closingBalance)}</p>
              </div>
              <Badge tone="emerald">Publik</Badge>
              {can("report.publish") && <Button size="sm" variant="ghost" className="text-expense" onClick={() => setUnpub(r.id)}><Trash2 className="h-4 w-4" /> Tarik</Button>}
            </div>
          )) : <p className="py-4 text-muted">Belum ada laporan yang dipublikasikan.</p>}
        </CardBody>
      </Card>

      <Dialog
        open={wa}
        onClose={() => setWa(false)}
        title="Bagikan ke WhatsApp"
        description="Ringkasan teks dapat langsung dikirim ke grup krama. Silakan ubah bila perlu."
        footer={
          <div className="grid gap-2 sm:grid-cols-3">
            <a href={whatsappLink(waText)} target="_blank" rel="noopener noreferrer" className="press inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#1FAF55] font-semibold text-white"><WhatsAppIcon className="h-5 w-5" /> Kirim teks</a>
            <Button size="lg" variant="outline" onClick={async () => { const ok = await sharePdfFile(doc, waText); if (!ok) { await exportPdf(doc); toast("Perangkat ini belum mendukung berbagi file", { description: "PDF diunduh — lampirkan manual di WhatsApp." }); } }}><Share2 className="h-4 w-4" /> Bagikan PDF</Button>
            <Button size="lg" variant="outline" onClick={() => { navigator.clipboard?.writeText(waText); toast.success("Teks disalin"); }}><Copy className="h-4 w-4" /> Salin teks</Button>
          </div>
        }
      >
        <Textarea value={waText} onChange={(e) => setWaText(e.target.value)} rows={12} className="font-mono text-sm" aria-label="Teks ringkasan" />
        <p className="mt-3 text-sm text-muted">Catatan: tautan WhatsApp hanya mengirim teks. Untuk melampirkan PDF, gunakan &ldquo;Bagikan PDF&rdquo; (didukung di sebagian besar ponsel) atau unduh lalu lampirkan manual.</p>
      </Dialog>
      <Dialog
        open={pub.open}
        onClose={() => setPub({ ...pub, open: false })}
        title="Publikasikan ringkasan"
        description="Salinan ringkasan (saldo, total per kategori) akan tampil di halaman publik pura. Rincian transaksi tidak ikut dipublikasikan."
        footer={<Button size="lg" className="w-full" disabled={pub.title.trim().length < 5} onClick={async () => { const r = await publish({ title: pub.title.trim(), from: f.from, to: f.to, note: pub.note.trim() || undefined }); if (!r.ok) return toast.error(r.error); setPub({ open: false, title: "", note: "" }); toast.success("Laporan dipublikasikan"); }}><Globe className="h-4 w-4" /> Publikasikan</Button>}
      >
        <div className="space-y-4">
          <Field label="Judul laporan" htmlFor="p-title"><Input id="p-title" value={pub.title} onChange={(e) => setPub({ ...pub, title: e.target.value })} /></Field>
          <Field label="Catatan untuk krama (opsional)" htmlFor="p-note"><Textarea id="p-note" rows={2} value={pub.note} onChange={(e) => setPub({ ...pub, note: e.target.value })} /></Field>
        </div>
      </Dialog>
      <ConfirmDialog open={!!unpub} onClose={() => setUnpub(null)} tone="danger" title="Tarik laporan dari publik?" description="Laporan tidak lagi tampil di halaman publik pura. Catatan transaksi tidak terpengaruh." confirmLabel="Tarik laporan" onConfirm={async () => { if (!unpub) return; const r = await unpublish(unpub); setUnpub(null); r.ok ? toast.success("Laporan ditarik") : toast.error(r.error); }} />
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense>
      <Reports />
    </Suspense>
  );
}
