"use client";
import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCheck, Image as ImageIcon, Inbox, Plus, X } from "lucide-react";
import { NoAccess, PageHeader } from "@/components/app/page-header";
import { useCan, useWorkspace } from "@/components/app/hooks";
import { ManualPuniaDialog } from "@/components/app/manual-punia";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Segmented } from "@/components/ui/segmented";
import { useStore } from "@/lib/store";
import { PURPOSE_LABEL } from "@/lib/permissions";
import { cn, formatDate, formatDateTime, rupiah } from "@/lib/format";
import type { Donation } from "@/lib/types";

type StatusFilter = "pending" | "verified" | "rejected" | "all";
const STATUS: Record<Donation["status"], { label: string; tone: "amber" | "green" | "red" }> = {
  pending: { label: "Menunggu", tone: "amber" },
  verified: { label: "Terverifikasi", tone: "green" },
  rejected: { label: "Ditolak", tone: "red" },
};
const CHANNEL: Record<Donation["channel"], string> = { transfer: "Transfer (aplikasi)", tunai: "Tunai", whatsapp: "WhatsApp", simulasi: "Simulasi" };

function PuniaQueue() {
  const ws = useWorkspace();
  const can = useCan();
  const me = useStore((s) => s.me);
  const verify = useStore((s) => s.verifyPunia);
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minAmount, setMinAmount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Donation>();
  const [rejecting, setRejecting] = useState<Donation>();
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(params.get("input") === "1");

  const isOwn = (d: Donation) => !!me && (d.submittedBy === me.id || (!!d.submitterEmail && d.submitterEmail.toLowerCase() === me.email.toLowerCase()));
  const list = useMemo(
    () =>
      ws.donations
        .filter((d) => status === "all" || d.status === status)
        .filter((d) => (!from || (d.transferDate ?? d.date) >= from) && (!to || (d.transferDate ?? d.date) <= to) && d.amount >= minAmount)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [ws.donations, status, from, to, minAmount]
  );
  const pending = ws.donations.filter((d) => d.status === "pending");
  const selectable = list.filter((d) => d.status === "pending" && !isOwn(d));

  useEffect(() => {
    const id = params.get("id");
    const d = id ? ws.donations.find((x) => x.id === id) : undefined;
    if (d) setOpen(d);
  }, [params, ws.donations]);
  useEffect(() => setSelected(new Set()), [status, ws.templeId]);

  if (!can("donation.manage") && !can("report.view")) return <NoAccess what="verifikasi punia" />;
  const canAct = can("donation.manage");

  async function approve(ids: string[]) {
    if (!ids.length) return;
    setBusy(true);
    const r = await verify(ids);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    const { verified, skipped } = r.value;
    if (verified) toast.success(`${verified} punia disetujui dan dicatat di kas.`);
    if (skipped.length) toast.warning(`${skipped.length} dilewati: ${skipped[0].reason}`);
    setSelected(new Set());
    setOpen(undefined);
  }

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div>
      <PageHeader
        title="Verifikasi Punia"
        description={ws.temple ? `${ws.temple.name} — cocokkan bukti dengan mutasi rekening, lalu setujui.` : undefined}
        actions={canAct && <Button onClick={() => setManual(true)}><Plus className="h-4 w-4" /> Input punia manual</Button>}
      />

      {pending.length > 0 && (
        <p className="mb-4 rounded-2xl bg-amber-50 p-4 text-[15px] font-semibold text-amber-900">{pending.length} punia menunggu verifikasi</p>
      )}
      {ws.temple && (ws.temple.pengurusCount ?? 0) === 0 && (
        <p className="mb-4 flex gap-2 rounded-2xl bg-sky-50 p-4 text-[15px] text-sky-900"><AlertTriangle className="h-5 w-5 shrink-0" /> Pengurus pura belum terdaftar — punia di pura ini diverifikasi oleh Pengurus Banjar.</p>
      )}

      <Card className="mb-4 space-y-3 p-4">
        <Segmented<StatusFilter>
          value={status}
          onChange={setStatus}
          className="flex w-full overflow-x-auto"
          ariaLabel="Status punia"
          size="sm"
          options={[
            { value: "pending", label: `Menunggu (${pending.length})` },
            { value: "verified", label: "Disetujui" },
            { value: "rejected", label: "Ditolak" },
            { value: "all", label: "Semua" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Field label="Dari tanggal" htmlFor="f-from"><Input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Sampai tanggal" htmlFor="f-to"><Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Nominal minimal" className="col-span-2 md:col-span-1"><MoneyInput value={minAmount} onChange={setMinAmount} /></Field>
        </div>
      </Card>

      {canAct && status === "pending" && selectable.length > 0 && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-soft backdrop-blur">
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={selected.size === selectable.length} onChange={(e) => setSelected(e.target.checked ? new Set(selectable.map((d) => d.id)) : new Set())} />
            Pilih semua ({selectable.length})
          </label>
          <Button className="ml-auto" disabled={!selected.size} loading={busy} onClick={() => approve(Array.from(selected))}>
            <CheckCheck className="h-4 w-4" /> Setujui {selected.size || ""} terpilih
          </Button>
        </div>
      )}

      {!list.length && <Card><EmptyState icon={Inbox} title={status === "pending" ? "Tidak ada punia yang menunggu" : "Tidak ada data"} description="Ubah filter untuk melihat punia lain." /></Card>}

      <ul className="space-y-3">
        {list.map((d) => {
          const own = isOwn(d);
          return (
            <li key={d.id}>
              <Card className={cn("flex gap-3 p-4", selected.has(d.id) && "ring-2 ring-emerald-500")}>
                {canAct && d.status === "pending" && (
                  <input type="checkbox" aria-label="Pilih" disabled={own} className="mt-1 h-5 w-5 shrink-0 accent-emerald-600" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
                )}
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(d)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-extrabold">{rupiah(d.amount)}</span>
                    <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
                    {d.privacy !== "public" && <Badge tone="gray">Anonim di publik</Badge>}
                    {d.possibleDuplicate && d.status === "pending" && <Badge tone="red">Kemungkinan dobel</Badge>}
                    {own && <Badge tone="violet">Punia Anda</Badge>}
                  </div>
                  <p className="mt-1 font-semibold">{d.donorName}</p>
                  <p className="text-sm text-muted">
                    {formatDate(d.transferDate ?? d.date)} · {CHANNEL[d.channel]} · {PURPOSE_LABEL[d.purpose ?? "umum"]}
                    {d.campaignId && ` · ${ws.campaigns.find((c) => c.id === d.campaignId)?.title ?? "Kegiatan"}`}
                  </p>
                  {d.referenceNo && <p className="text-sm text-muted">Ref: {d.referenceNo}</p>}
                </button>
                {d.evidence && <ImageIcon className="h-5 w-5 shrink-0 text-muted" aria-label="Ada bukti" />}
              </Card>
            </li>
          );
        })}
      </ul>

      {open && (
        <Dialog
          open
          onClose={() => { setOpen(undefined); if (params.get("id")) router.replace("/app/punia"); }}
          title={`Punia ${rupiah(open.amount)}`}
          description={`${open.donorName}${open.privacy !== "public" ? " (tampil sebagai Anonim)" : ""}`}
          footer={
            canAct && open.status === "pending" ? (
              isOwn(open) ? (
                <p className="w-full rounded-xl bg-violet-50 p-3 text-center text-[15px] text-violet-900">Ini punia Anda sendiri — harus disetujui pengurus lain.</p>
              ) : (
                <div className="grid w-full grid-cols-2 gap-2">
                  <Button variant="outline" size="lg" onClick={() => { setRejecting(open); setOpen(undefined); }}><X className="h-5 w-5" /> Tolak</Button>
                  <Button size="lg" loading={busy} onClick={() => approve([open.id])}><Check className="h-5 w-5" /> Setuju</Button>
                </div>
              )
            ) : undefined
          }
        >
          <DonationDetail d={open} campaign={ws.campaigns.find((c) => c.id === open.campaignId)?.title} />
        </Dialog>
      )}
      {rejecting && <RejectDialog d={rejecting} onClose={() => setRejecting(undefined)} />}
      <ManualPuniaDialog open={manual} onClose={() => { setManual(false); if (params.get("input")) router.replace("/app/punia"); }} />
    </div>
  );
}

function DonationDetail({ d, campaign }: { d: Donation; campaign?: string }) {
  const rows: [string, React.ReactNode][] = [
    ["Status", STATUS[d.status].label],
    ["Tanggal transfer", formatDate(d.transferDate ?? d.date)],
    ["Dikirim", formatDateTime(d.createdAt)],
    ["Lewat", CHANNEL[d.channel]],
    ["Tujuan", PURPOSE_LABEL[d.purpose ?? "umum"]],
    ...(campaign ? [["Kegiatan", campaign] as [string, React.ReactNode]] : []),
    ...(d.referenceNo ? [["No. referensi", d.referenceNo] as [string, React.ReactNode]] : []),
    ...(d.submitterEmail ? [["Email", d.submitterEmail] as [string, React.ReactNode]] : []),
    ...(d.message ? [["Pesan", d.message] as [string, React.ReactNode]] : []),
    ...(d.rejectedReason ? [["Alasan ditolak", d.rejectedReason] as [string, React.ReactNode]] : []),
  ];
  return (
    <div className="space-y-4">
      {d.possibleDuplicate && d.status === "pending" && (
        <p className="flex gap-2 rounded-xl bg-red-50 p-3 text-[15px] text-red-800"><AlertTriangle className="h-5 w-5 shrink-0" /> Ada punia lain dengan nominal dan tanggal yang sama. Periksa apakah ini dobel.</p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]">
        {rows.map(([k, v]) => (<Fragment key={k}><dt className="text-muted">{k}</dt><dd className="break-words font-medium">{v}</dd></Fragment>))}
      </dl>
      {d.evidence ? (
        <a href={d.evidence} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={d.evidence} alt="Bukti transfer" className="max-h-[60vh] w-full object-contain bg-ivory" />
        </a>
      ) : (
        <p className="rounded-xl bg-ivory p-3 text-sm text-muted">Tidak ada foto bukti.</p>
      )}
    </div>
  );
}

const REASONS = ["Bukti transfer tidak jelas", "Nominal tidak sesuai mutasi rekening", "Transfer belum masuk ke rekening pura", "Bukti dobel / sudah pernah dikirim"];

function RejectDialog({ d, onClose }: { d: Donation; onClose: () => void }) {
  const reject = useStore((s) => s.rejectPunia);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (reason.trim().length < 5) return toast.error("Tuliskan alasan penolakan agar umat dapat memperbaikinya.");
    setBusy(true);
    const r = await reject(d.id, reason.trim());
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Punia ditolak. Umat akan melihat alasannya.");
    onClose();
  }
  return (
    <Dialog open onClose={onClose} title="Tolak punia" description={`${rupiah(d.amount)} — ${d.donorName}`} footer={<Button variant="danger" size="lg" className="w-full" loading={busy} onClick={submit}>Tolak punia</Button>}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className={cn("press rounded-full border px-3 py-1.5 text-sm", reason === r ? "border-emerald-500 bg-mint" : "border-line bg-white")}>{r}</button>
          ))}
        </div>
        <Field label="Alasan (dilihat oleh umat)" htmlFor="rj-reason"><Textarea id="rj-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}

export default function PuniaPage() {
  return (
    <Suspense>
      <PuniaQueue />
    </Suspense>
  );
}

