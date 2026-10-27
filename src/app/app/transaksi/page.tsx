"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { TxRow } from "@/components/app/tx-row";
import { useCan, useWorkspace } from "@/components/app/hooks";
import { Card } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { incomeOf, expenseOf } from "@/lib/ledger";
import { formatMonth, rupiah } from "@/lib/format";

type TypeFilter = "all" | "income" | "expense" | "transfer";
interface Filters {
  from: string;
  to: string;
  categoryId: string;
  activityId: string;
  accountId: string;
  status: "" | "draft" | "confirmed" | "corrected";
  sort: "newest" | "oldest" | "largest" | "smallest";
}

function TransactionsList() {
  const params = useSearchParams();
  const ws = useWorkspace();
  const can = useCan();
  const [q, setQ] = useState("");
  const [type, setType] = useState<TypeFilter>((params.get("type") as TypeFilter) || "all");
  const empty: Filters = { from: "", to: "", categoryId: "", activityId: params.get("activity") ?? "", accountId: "", status: (params.get("status") as Filters["status"]) ?? "", sort: "newest" };
  const [filters, setFilters] = useState<Filters>(empty);
  const [draft, setDraft] = useState<Filters>(empty);
  const [open, setOpen] = useState(false);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const r = ws.transactions.filter((t) => {
      if (type !== "all" && t.type !== type) return false;
      if (filters.from && t.date < filters.from) return false;
      if (filters.to && t.date > filters.to) return false;
      if (filters.categoryId && t.categoryId !== filters.categoryId) return false;
      if (filters.activityId && t.activityId !== filters.activityId) return false;
      if (filters.accountId && t.accountId !== filters.accountId && t.toAccountId !== filters.accountId) return false;
      if (filters.status === "draft" && t.status !== "draft") return false;
      if (filters.status === "confirmed" && t.status !== "confirmed") return false;
      if (filters.status === "corrected" && !t.reversedBy && !t.reversalOf) return false;
      if (s) {
        const cat = ws.categories.find((c) => c.id === t.categoryId)?.name ?? "";
        const hay = `${t.description} ${t.number} ${cat} ${t.source ?? ""} ${t.notes ?? ""} ${t.amount}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
    const cmp = {
      newest: (a: typeof r[0], b: typeof r[0]) => (b.date === a.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)),
      oldest: (a: typeof r[0], b: typeof r[0]) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)),
      largest: (a: typeof r[0], b: typeof r[0]) => b.amount - a.amount,
      smallest: (a: typeof r[0], b: typeof r[0]) => a.amount - b.amount,
    }[filters.sort];
    return r.sort(cmp);
  }, [ws, q, type, filters]);

  const groups = useMemo(() => {
    if (filters.sort === "largest" || filters.sort === "smallest") return [{ key: "Semua", items: list }];
    const g: { key: string; items: typeof list }[] = [];
    for (const t of list) {
      const key = formatMonth(t.date);
      const last = g[g.length - 1];
      if (last?.key === key) last.items.push(t);
      else g.push({ key, items: [t] });
    }
    return g;
  }, [list, filters.sort]);

  const activeCount = (Object.keys(filters) as (keyof Filters)[]).filter((k) => k !== "sort" && filters[k]).length + (filters.sort !== "newest" ? 1 : 0);
  const inc = incomeOf(list);
  const exp = expenseOf(list);
  const chip = (label: string, clear: () => void) => (
    <button key={label} onClick={clear} className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-200">
      {label} <X className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Transaksi"
        description="Semua pemasukan, pengeluaran, dan pindah dana pura."
        actions={
          (can("tx.create") || can("tx.draft")) && (
            <>
              <Link href="/app/transaksi/baru?type=income" className={buttonClass("secondary", "md")}><ArrowDownLeft className="h-4 w-4" /> Pemasukan</Link>
              <Link href="/app/transaksi/baru?type=expense" className={buttonClass("primary", "md")}><ArrowUpRight className="h-4 w-4" /> Pengeluaran</Link>
            </>
          )
        }
      />
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="cari" className="sr-only">Cari transaksi</label>
          <input id="cari" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari keterangan, nomor, atau nominal…" className="h-12 w-full rounded-xl border border-line bg-white pl-12 pr-4 text-[16px] focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15" />
        </div>
        <Button variant="outline" size="lg" onClick={() => { setDraft(filters); setOpen(true); }} className="h-12">
          <SlidersHorizontal className="h-5 w-5" /> Filter & urutkan {activeCount > 0 && <span className="rounded-full bg-emerald-600 px-2 text-xs text-white">{activeCount}</span>}
        </Button>
      </div>
      <div className="no-scrollbar -mx-4 mt-3 overflow-x-auto px-4">
        <Segmented
          value={type}
          onChange={setType}
          ariaLabel="Jenis transaksi"
          options={[
            { value: "all", label: "Semua" },
            { value: "income", label: "Pemasukan" },
            { value: "expense", label: "Pengeluaran" },
            { value: "transfer", label: "Pindah dana" },
          ]}
        />
      </div>
      {activeCount > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.from && chip(`Dari ${filters.from}`, () => setFilters({ ...filters, from: "" }))}
          {filters.to && chip(`Sampai ${filters.to}`, () => setFilters({ ...filters, to: "" }))}
          {filters.categoryId && chip(ws.categories.find((c) => c.id === filters.categoryId)?.name ?? "Kategori", () => setFilters({ ...filters, categoryId: "" }))}
          {filters.activityId && chip(ws.activities.find((c) => c.id === filters.activityId)?.name ?? "Kegiatan", () => setFilters({ ...filters, activityId: "" }))}
          {filters.accountId && chip(ws.accounts.find((c) => c.id === filters.accountId)?.name ?? "Rekening", () => setFilters({ ...filters, accountId: "" }))}
          {filters.status && chip({ draft: "Draf", confirmed: "Terkonfirmasi", corrected: "Koreksi" }[filters.status], () => setFilters({ ...filters, status: "" }))}
          {filters.sort !== "newest" && chip({ newest: "", oldest: "Terlama", largest: "Nominal terbesar", smallest: "Nominal terkecil" }[filters.sort], () => setFilters({ ...filters, sort: "newest" }))}
          <button onClick={() => setFilters({ ...empty, activityId: "", status: "" })} className="px-2 text-sm font-semibold text-muted hover:text-charcoal">Hapus semua</button>
        </div>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-white p-3 text-center shadow-soft">
        <div><p className="text-xs text-muted">Masuk</p><p className="tabular text-sm font-bold text-income md:text-base">{rupiah(inc)}</p></div>
        <div><p className="text-xs text-muted">Keluar</p><p className="tabular text-sm font-bold text-expense md:text-base">{rupiah(exp)}</p></div>
        <div><p className="text-xs text-muted">{list.length} transaksi</p><p className="tabular text-sm font-bold md:text-base">{rupiah(inc - exp, { sign: true })}</p></div>
      </div>
      <p className="mt-2 text-xs text-muted">Ringkasan hanya menghitung transaksi terkonfirmasi; pindah dana tidak dihitung sebagai pemasukan/pengeluaran.</p>

      <div className="mt-4 space-y-5">
        {groups.map((g) => (
          <section key={g.key} aria-label={g.key}>
            <h2 className="sticky top-16 z-10 -mx-1 bg-ivory/90 px-1 py-2 text-sm font-bold uppercase tracking-wider text-muted backdrop-blur">{g.key}</h2>
            <Card className="px-2 py-1">
              {g.items.map((t) => (
                <TxRow key={t.id} tx={t} category={ws.categories.find((c) => c.id === t.categoryId)} accountName={ws.accounts.find((a) => a.id === t.accountId)?.name} activityName={ws.activities.find((a) => a.id === t.activityId)?.name} />
              ))}
            </Card>
          </section>
        ))}
        {list.length === 0 && (
          <Card><EmptyState icon={SearchX} title="Tidak ada transaksi yang cocok" description="Ubah kata kunci atau hapus filter." /></Card>
        )}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Filter & urutkan"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setDraft({ ...empty, activityId: "", status: "" })}>Atur ulang</Button>
            <Button size="lg" className="flex-1" onClick={() => { setFilters(draft); setOpen(false); }}>Terapkan</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dari tanggal" htmlFor="f-from"><Input id="f-from" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></Field>
            <Field label="Sampai tanggal" htmlFor="f-to"><Input id="f-to" type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></Field>
          </div>
          <Field label="Kategori" htmlFor="f-cat">
            <Select id="f-cat" value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}>
              <option value="">Semua kategori</option>
              <optgroup label="Pemasukan">{ws.categories.filter((c) => c.type === "income").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
              <optgroup label="Pengeluaran">{ws.categories.filter((c) => c.type === "expense").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
            </Select>
          </Field>
          <Field label="Kegiatan" htmlFor="f-act">
            <Select id="f-act" value={draft.activityId} onChange={(e) => setDraft({ ...draft, activityId: e.target.value })}>
              <option value="">Semua kegiatan</option>
              {ws.activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Kas / rekening" htmlFor="f-acc">
            <Select id="f-acc" value={draft.accountId} onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}>
              <option value="">Semua</option>
              {ws.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Status" htmlFor="f-status">
            <Select id="f-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Filters["status"] })}>
              <option value="">Semua status</option>
              <option value="confirmed">Terkonfirmasi</option>
              <option value="draft">Draf</option>
              <option value="corrected">Koreksi / dikoreksi</option>
            </Select>
          </Field>
          <Field label="Urutkan" htmlFor="f-sort">
            <Select id="f-sort" value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: e.target.value as Filters["sort"] })}>
              <option value="newest">Terbaru dulu</option>
              <option value="oldest">Terlama dulu</option>
              <option value="largest">Nominal terbesar</option>
              <option value="smallest">Nominal terkecil</option>
            </Select>
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsList />
    </Suspense>
  );
}
