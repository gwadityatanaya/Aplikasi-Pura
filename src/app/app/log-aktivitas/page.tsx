"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Download, Globe2, KeyRound, Lock, LogIn, ReceiptText, ScrollText, Search, ShieldAlert, UserCog } from "lucide-react";
import { PageHeader, NoAccess } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccess, useStore } from "@/lib/store";
import { cn, formatDateTime } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";

const KINDS = [
  { value: "all", label: "Semua aktivitas" },
  { value: "login", label: "Login & keamanan" },
  { value: "transaction", label: "Transaksi" },
  { value: "donation", label: "Donasi" },
  { value: "campaign", label: "Campaign" },
  { value: "user", label: "Pengguna & peran" },
  { value: "settings", label: "Banjar, pura & rekening" },
  { value: "report", label: "Laporan" },
  { value: "backup", label: "Cadangan data" },
];

function iconFor(e: AuditEntry) {
  if (/gagal|ditolak|diblokir/i.test(e.action)) return { Icon: ShieldAlert, tone: "bg-red-50 text-red-700" };
  if (e.entity === "session") return { Icon: e.action.includes("sandi") ? KeyRound : LogIn, tone: "bg-sky-50 text-sky-700" };
  if (e.entity === "transaction") return { Icon: ReceiptText, tone: "bg-mint text-emerald-700" };
  if (e.entity === "user") return { Icon: UserCog, tone: "bg-violet-50 text-violet-700" };
  return { Icon: ScrollText, tone: "bg-stone-100 text-stone-700" };
}

function Changes({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") return null;
  const entries = Object.entries(value as Record<string, unknown>);
  return (
    <dl className="mt-2 space-y-1 rounded-xl bg-ivory p-3 text-xs">
      {entries.map(([k, v]) => {
        const change = v && typeof v === "object" && "dari" in (v as object) ? (v as { dari: unknown; menjadi: unknown }) : null;
        return (
          <div key={k} className="flex flex-wrap gap-x-2">
            <dt className="font-semibold text-charcoal">{k}:</dt>
            <dd className="break-all text-muted">
              {change ? <>{JSON.stringify(change.dari)} → <span className="text-charcoal">{JSON.stringify(change.menjadi)}</span></> : JSON.stringify(v).slice(0, 400)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export default function ActivityLogPage() {
  // Admin Utama only — checked on the account (like the server), not on the open temple's role.
  const isAdmin = useAccess().isSuperAdmin;
  const temples = useStore((s) => s.data.temples);
  const [filters, setFilters] = useState({ kind: "all", q: "", from: "", to: "", temple: "" });
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(
    async (before?: number) => {
      setLoading(true);
      setError("");
      const qs = new URLSearchParams({ ...filters, limit: "50", ...(before ? { before: String(before) } : {}) });
      try {
        const res = await fetch(`/api/admin/log?${qs}`, { cache: "no-store" });
        const j = await res.json();
        if (!j.ok) throw new Error(j.error);
        setEntries((cur) => (before && cur ? [...cur, ...j.entries] : j.entries));
        setNext(j.nextBefore);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat log.");
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    if (isAdmin) {
      const t = setTimeout(() => load(), 250);
      return () => clearTimeout(t);
    }
  }, [load, isAdmin]);

  if (!isAdmin) return <NoAccess what="Log Aktivitas" />;

  function exportCsv() {
    if (!entries) return;
    const head = ["Waktu", "Pengguna", "Email", "Aktivitas", "Keterangan", "Pura", "IP"];
    const rows = entries.map((e) => [formatDateTime(e.at), e.actorName, e.actorEmail ?? "", e.action, e.detail, temples.find((t) => t.id === e.templeId)?.name ?? "", e.ip ?? ""]);
    const csv = "﻿" + [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `log-aktivitas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Log Aktivitas"
        description="Siapa masuk, siapa mencatat, mengubah, atau menghapus data — dan kapan. Hanya Admin Utama yang dapat membuka halaman ini."
        actions={<Button variant="outline" onClick={exportCsv} disabled={!entries?.length}><Download className="h-4 w-4" /> Unduh CSV</Button>}
      />
      <p className="mb-4 flex items-start gap-2 rounded-2xl bg-charcoal p-4 text-sm text-white/90">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <span>Log ini <strong>tidak dapat diubah atau dihapus</strong> oleh siapa pun dari aplikasi — termasuk Admin Utama. Database menolak setiap upaya mengubahnya.</span>
      </p>
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input aria-label="Cari log" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Cari nama, email, atau keterangan…" className="h-12 w-full rounded-xl border border-line bg-white pl-12 pr-4 text-[16px] focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15" />
          </div>
          <Select aria-label="Jenis aktivitas" value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value })}>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </Select>
          <Select aria-label="Pura" value={filters.temple} onChange={(e) => setFilters({ ...filters, temple: e.target.value })}>
            <option value="">Semua pura</option>
            {temples.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:max-w-md">
          <Field label="Dari tanggal" htmlFor="lf"><Input id="lf" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></Field>
          <Field label="Sampai tanggal" htmlFor="lt"><Input id="lt" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></Field>
        </div>
      </Card>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Card className="mt-4 overflow-hidden">
        {!entries && loading && <div className="space-y-3 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>}
        {entries && (
          <ol className="divide-y divide-line">
            {entries.map((e) => {
              const { Icon, tone } = iconFor(e);
              const temple = temples.find((t) => t.id === e.templeId);
              const expanded = open === e.id;
              return (
                <li key={e.id} className="p-4">
                  <button className="flex w-full items-start gap-3 text-left" onClick={() => setOpen(expanded ? null : e.id)} aria-expanded={expanded}>
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tone)}><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{e.action}</span>
                        {temple && <Badge tone="gray">{temple.name}</Badge>}
                      </span>
                      <span className="mt-0.5 block text-[15px] text-charcoal/80">{e.detail}</span>
                      <span className="mt-1 block text-sm text-muted">
                        {e.actorName}{e.actorEmail ? ` · ${e.actorEmail}` : ""} · {formatDateTime(e.at)}
                      </span>
                    </span>
                    <ChevronDown className={cn("mt-2 h-4 w-4 shrink-0 text-muted transition-transform", expanded && "rotate-180")} />
                  </button>
                  {expanded && (
                    <div className="ml-[52px] mt-2 text-sm text-muted">
                      <p className="flex items-center gap-1.5"><Globe2 className="h-3.5 w-3.5" /> IP: {e.ip ?? "—"}</p>
                      {e.userAgent && <p className="mt-0.5 break-all text-xs">Perangkat: {e.userAgent}</p>}
                      <Changes value={e.changes} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {entries && entries.length === 0 && <EmptyState icon={ScrollText} title="Tidak ada aktivitas" description="Ubah filter atau rentang tanggal." />}
        {next && (
          <div className="border-t border-line p-4 text-center">
            <Button variant="outline" onClick={() => load(next)} loading={loading}>Muat lebih banyak</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
