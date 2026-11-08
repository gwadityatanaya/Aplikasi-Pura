"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireLogin } from "@/components/umat/use-umat";
import { api } from "@/lib/store";
import { PROOF_NOT_RECEIPT, PROOF_STATUS, downloadProofPdf, proofRows, type PuniaProof } from "@/lib/punia-proof";

/** Bukti punia digital: one punia of the signed-in person (the server refuses anyone else). */
export default function PuniaProofPage({ params }: { params: { id: string } }) {
  const { ready } = useRequireLogin();
  const [proof, setProof] = useState<PuniaProof | null>(null);
  const [error, setError] = useState<string>();
  const [showName, setShowName] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    api<{ proof: PuniaProof }>(`/api/umat/punia/${encodeURIComponent(params.id)}`).then(({ json }) => {
      if (json.ok) {
        setProof(json.proof);
        setShowName(!json.proof.anonymous);
      } else setError(json.error ?? "Bukti punia tidak bisa dimuat.");
    });
  }, [ready, params.id]);

  async function pdf() {
    if (!proof) return;
    setBusy(true);
    try {
      await downloadProofPdf(proof, showName);
    } catch {
      toast.error("PDF gagal dibuat. Coba lagi.");
    }
    setBusy(false);
  }

  return (
    <div className="container max-w-2xl py-8">
      <Link href="/umat/punia" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 print:hidden"><ArrowLeft className="h-4 w-4" /> Punia Saya</Link>
      <h1 className="mt-2 text-3xl font-extrabold text-forest">Bukti pencatatan punia</h1>
      <p className="text-muted print:hidden">Hanya Anda yang dapat membuka halaman ini.</p>

      {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-800" role="alert">{error}</p>}
      {!proof && !error && <Skeleton className="mt-6 h-96 rounded-3xl" />}
      {proof && (
        <div className="mt-6 overflow-hidden rounded-3xl border border-line bg-white shadow-soft">
          <div className="bg-forest px-5 py-4 text-white">
            <p className="text-sm opacity-90">{proof.templeName}</p>
            <p className="mt-1 break-words text-3xl font-extrabold">{proofRows(proof, showName)[1][1]}</p>
          </div>
          <div className="space-y-4 p-5">
            <p className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[0.9375rem] font-semibold text-amber-900" data-testid="bukan-kuitansi">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <span>{PROOF_NOT_RECEIPT}</span>
            </p>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[11rem_1fr]">
              {proofRows(proof, showName).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd className="-mt-1.5 break-words font-semibold sm:mt-0">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[0.9375rem] text-muted">{PROOF_STATUS[proof.status].desc}</p>
            {proof.anonymous && (
              <label className="flex items-start gap-2 rounded-xl bg-mint/50 p-3 text-[0.9375rem] font-semibold print:hidden">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
                <span>Tampilkan nama saya di bukti ini <span className="block font-normal text-muted">Punia ini anonim: di halaman dan laporan pura tertulis &quot;Anonim&quot;. Jika dicentang, nama Anda ikut tercetak di PDF. Biarkan tidak dicentang jika PDF akan Anda bagikan.</span></span>
              </label>
            )}
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button onClick={pdf} loading={busy}><FileDown className="h-5 w-5" /> Unduh PDF</Button>
              <Button variant="outline" onClick={() => window.print()}><Printer className="h-5 w-5" /> Cetak</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
