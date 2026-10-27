"use client";
import { templeLocation } from "@/lib/temple";
import Link from "next/link";
import { ChevronRight, HandHeart, History, LayoutDashboard, MapPin, UserRound } from "lucide-react";
import { TempleCover } from "@/components/brand/temple-cover";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_INFO, useMyPunia, useRequireLogin } from "@/components/umat/use-umat";
import { usePublicData } from "@/lib/public";
import { useStore } from "@/lib/store";
import { formatDate, greeting, rupiah } from "@/lib/format";

/** Home for umat: send a punia, and see what happened to the ones already sent. */
export default function UmatHome() {
  const { ready, me } = useRequireLogin();
  const isStaff = useStore((s) => s.access.isStaff);
  const { punia } = useMyPunia(ready);
  const { hydrated, temples } = usePublicData();
  if (!ready || !me) return <div className="container max-w-3xl py-10"><Skeleton className="h-40 rounded-3xl" /></div>;

  const pending = punia?.filter((d) => d.status === "pending").length ?? 0;
  const rejected = punia?.filter((d) => d.status === "rejected").length ?? 0;

  return (
    <div className="container max-w-3xl py-8">
      <p className="text-muted">{greeting()},</p>
      <h1 className="text-3xl font-extrabold text-forest">{me.callName || me.name}</h1>

      {isStaff && (
        <Link href="/app" className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-mint/60 p-4 font-semibold text-emerald-900">
          <LayoutDashboard className="h-5 w-5" /> Anda juga pengurus — buka Dashboard <ChevronRight className="ml-auto h-5 w-5" />
        </Link>
      )}

      {rejected > 0 && (
        <Link href="/umat/punia" className="mt-4 flex items-center gap-3 rounded-2xl bg-red-50 p-4 font-semibold text-red-800">
          {rejected} punia ditolak — lihat alasan dan kirim ulang <ChevronRight className="ml-auto h-5 w-5" />
        </Link>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link href="/umat/punia" className="press rounded-2xl border border-line bg-white p-4 shadow-soft">
          <History className="h-6 w-6 text-emerald-700" />
          <p className="mt-2 font-bold">Riwayat punia</p>
          <p className="text-sm text-muted">{punia ? `${punia.length} punia${pending ? `, ${pending} menunggu` : ""}` : "Memuat…"}</p>
        </Link>
        <Link href="/umat/akun" className="press rounded-2xl border border-line bg-white p-4 shadow-soft">
          <UserRound className="h-6 w-6 text-emerald-700" />
          <p className="mt-2 font-bold">Akun saya</p>
          <p className="truncate text-sm text-muted">{me.email}</p>
        </Link>
      </div>

      <h2 className="mt-8 text-xl font-bold">Berpunia ke pura</h2>
      <p className="text-muted">Pilih pura, transfer lewat m-banking, lalu unggah bukti transfernya.</p>
      <div className="mt-4 space-y-3">
        {!hydrated && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        {temples.map((t) => (
          <Card key={t.id} className="flex items-center gap-3 overflow-hidden p-3">
            <TempleCover variant={t.cover} image={t.photo} alt="" className="h-20 w-20 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <Link href={`/pura/${t.slug}`} className="font-bold hover:underline">{t.name}</Link>
              {templeLocation(t) && <p className="flex items-center gap-1 truncate text-sm text-muted"><MapPin className="h-3.5 w-3.5 shrink-0" /> {templeLocation(t)}</p>}
              {t.banjarNames.length > 0 && <p className="truncate text-xs text-muted">Pengempon: {t.banjarNames.join(", ")}</p>}
              {!t.hasPengurus && <p className="text-xs font-semibold text-sky-800">Pengurus pura belum terdaftar</p>}
            </div>
            {t.acceptsPunia ? (
              <Link href={`/pura/${t.slug}/punia`} className={buttonClass("primary", "md", "shrink-0")}><HandHeart className="h-4 w-4" /> Punia</Link>
            ) : (
              <Badge tone="gray" className="shrink-0">Rekening belum ada</Badge>
            )}
          </Card>
        ))}
      </div>

      {punia && punia.length > 0 && (
        <>
          <h2 className="mt-8 text-xl font-bold">Punia terakhir</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {punia.slice(0, 3).map((d) => (
              <li key={d.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{rupiah(d.amount)}</p>
                  <p className="truncate text-sm text-muted">{d.temple?.name} · {formatDate(d.transferDate ?? d.date)}</p>
                </div>
                <Badge tone={STATUS_INFO[d.status].tone}>{STATUS_INFO[d.status].label}</Badge>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
