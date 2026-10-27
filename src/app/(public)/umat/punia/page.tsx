"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, HandHeart, Inbox, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { ImageUpload } from "@/components/ui/file-upload";
import { MoneyInput } from "@/components/ui/money-input";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_INFO, useMyPunia, useRequireLogin, type MyPunia } from "@/components/umat/use-umat";
import { useStore } from "@/lib/store";
import { PURPOSE_LABEL } from "@/lib/permissions";
import { formatDate, rupiah, todayISO } from "@/lib/format";

export default function MyPuniaPage() {
  const { ready } = useRequireLogin();
  const { punia, error, reload } = useMyPunia(ready);
  const [fix, setFix] = useState<MyPunia>();

  return (
    <div className="container max-w-3xl py-8">
      <Link href="/umat" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
      <h1 className="mt-2 text-3xl font-extrabold text-forest">Riwayat punia saya</h1>
      <p className="text-muted">Hanya Anda yang dapat melihat halaman ini.</p>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
      {!punia && !error && <div className="mt-6 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>}
      {punia && punia.length === 0 && (
        <EmptyState icon={Inbox} title="Belum ada punia" description="Punia yang Anda kirim lewat aplikasi akan muncul di sini beserta statusnya." action={<Link href="/umat" className={buttonClass("primary", "lg")}><HandHeart className="h-5 w-5" /> Berpunia sekarang</Link>} />
      )}

      <ul className="mt-6 space-y-3">
        {punia?.map((d) => {
          const s = STATUS_INFO[d.status];
          return (
            <li key={d.id} className="rounded-2xl border border-line bg-white p-4 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xl font-extrabold">{rupiah(d.amount)}</p>
                  <p className="text-[15px] font-semibold">{d.temple?.name ?? "Pura"}</p>
                </div>
                <Badge tone={s.tone} className="text-sm">{s.label}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted">Tanggal transfer</dt><dd>{formatDate(d.transferDate ?? d.date)}</dd>
                <dt className="text-muted">Tujuan</dt><dd>{PURPOSE_LABEL[d.purpose ?? "umum"]}</dd>
                <dt className="text-muted">Nama ditampilkan</dt><dd>{d.privacy === "public" ? "Tampil" : "Anonim"}</dd>
                {d.referenceNo && (<><dt className="text-muted">No. referensi</dt><dd className="break-all">{d.referenceNo}</dd></>)}
                {d.channel !== "transfer" && (<><dt className="text-muted">Dicatat</dt><dd>oleh pengurus ({d.channel})</dd></>)}
              </dl>
              <p className="mt-2 text-sm text-muted">{s.desc}</p>
              {d.status === "rejected" && (
                <div className="mt-3 rounded-xl bg-red-50 p-3 text-[15px] text-red-900">
                  <p><b>Alasan ditolak:</b> {d.rejectedReason || "-"}</p>
                  {d.submittedBy && (
                    <Button className="mt-3" onClick={() => setFix(d)}><RotateCcw className="h-4 w-4" /> Perbaiki & kirim ulang</Button>
                  )}
                </div>
              )}
              {d.evidence && <a href={d.evidence} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-emerald-800 underline">Lihat bukti transfer</a>}
            </li>
          );
        })}
      </ul>
      {fix && <ResubmitDialog punia={fix} onClose={() => setFix(undefined)} onDone={reload} />}
    </div>
  );
}

function ResubmitDialog({ punia, onClose, onDone }: { punia: MyPunia; onClose: () => void; onDone: () => void }) {
  const run = useStore((s) => s.run);
  const [amount, setAmount] = useState(punia.amount);
  const [date, setDate] = useState(punia.transferDate ?? punia.date);
  const [ref, setRef] = useState(punia.referenceNo ?? "");
  const [evidence, setEvidence] = useState<string | undefined>(punia.evidence);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (amount < 1000) return toast.error("Isi nominal punia.");
    setBusy(true);
    const r = await run("resubmitPunia", { id: punia.id, amount, transferDate: date, referenceNo: ref || null, evidence });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Punia dikirim ulang dan menunggu verifikasi.");
    onDone();
    onClose();
  }
  return (
    <Dialog open onClose={onClose} title="Kirim ulang punia" description={`Alasan ditolak: ${punia.rejectedReason ?? "-"}`} footer={<Button size="lg" className="w-full" loading={busy} onClick={submit}>Kirim ulang</Button>}>
      <div className="space-y-4">
        <Field label="Nominal"><MoneyInput value={amount} onChange={setAmount} /></Field>
        <Field label="Tanggal transfer" htmlFor="rs-date"><Input id="rs-date" type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="No. referensi (opsional)" htmlFor="rs-ref"><Input id="rs-ref" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        <Field label="Bukti transfer" hint="Ganti foto jika bukti sebelumnya kurang jelas.">
          <ImageUpload value={evidence} onChange={(v) => setEvidence(v)} label="Bukti transfer" />
        </Field>
      </div>
    </Dialog>
  );
}
