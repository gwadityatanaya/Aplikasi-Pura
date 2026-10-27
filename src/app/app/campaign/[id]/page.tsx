"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ExternalLink, FlaskConical, HandCoins, Megaphone, Pencil, Plus, Rocket, ShieldCheck, Square, XCircle } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { useCan, useWorkspace } from "@/components/app/hooks";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { ImageUpload } from "@/components/ui/file-upload";
import { AnimatedRupiah } from "@/components/ui/animated-number";
import { TempleCover } from "@/components/brand/temple-cover";
import { CampaignStatusBadge, daysLeftLabel } from "@/components/shared/campaign-card";
import { ShareActions } from "@/components/shared/share";
import { SimulationTag } from "@/components/shared/prototype-banner";
import { PrivacyPicker } from "@/components/public/donations";
import { useStore } from "@/lib/store";
import { campaignStats } from "@/lib/ledger";
import { formatDate, formatDateShort, formatPercent, rupiah, todayISO } from "@/lib/format";
import type { Donation } from "@/lib/types";

const PRIVACY_LABEL = { public: "Nama & nominal publik", anonymous: "Anonim, nominal publik", private: "Privat (hanya total)" };

function CampaignAdmin() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const ws = useWorkspace();
  const can = useCan();
  const verify = useStore((s) => s.verifyDonation);
  const reject = useStore((s) => s.rejectDonation);
  const simulate = useStore((s) => s.simulateDonation);
  const setStatus = useStore((s) => s.setCampaignStatus);
  const addUpdate = useStore((s) => s.addCampaignUpdate);
  const [tab, setTab] = useState<"ringkasan" | "verifikasi" | "donasi" | "kabar">((params.get("tab") as "verifikasi") || "ringkasan");
  const [verifying, setVerifying] = useState<Donation | null>(null);
  const [rejecting, setRejecting] = useState<Donation | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [manual, setManual] = useState(false);
  const [closing, setClosing] = useState<"completed" | "active" | null>(null);
  const [upd, setUpd] = useState({ open: false, title: "", body: "" });
  const [evidence, setEvidence] = useState<Donation | null>(null);

  const c = ws.campaigns.find((x) => x.id === id);
  if (!c) return <Card><EmptyState icon={Megaphone} title="Campaign tidak ditemukan" action={<Link href="/app/campaign" className={buttonClass()}>Kembali</Link>} /></Card>;
  const s = campaignStats(c, ws.donations);
  const own = ws.donations.filter((d) => d.campaignId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const spent = ws.transactions.filter((t) => t.campaignId === c.id && t.type === "expense" && t.status === "confirmed").reduce((sum, t) => sum + (t.reversalOf ? -t.amount : t.amount), 0);
  const manage = can("donation.manage");

  return (
    <div>
      <PageHeader
        back={{ href: "/app/campaign", label: "Penggalangan Dana" }}
        title={c.title}
        description={`${formatDate(c.startDate)} – ${formatDate(c.endDate)}`}
        actions={
          <>
            {c.status !== "draft" && <Link href={`/donasi/${c.slug}`} target="_blank" className={buttonClass("outline")}><ExternalLink className="h-4 w-4" /> Halaman publik</Link>}
            {c.status === "draft" && can("campaign.manage") && (
              <>
                <Link href={`/app/campaign/baru?edit=${c.id}`} className={buttonClass("outline")}><Pencil className="h-4 w-4" /> Ubah</Link>
                <Button onClick={() => setClosing("active")}><Rocket className="h-4 w-4" /> Terbitkan</Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden" data-tour="campaign-progress">
          <div className="grid md:grid-cols-[220px_1fr]">
            <TempleCover variant={c.cover} image={c.coverImage} className="h-36 md:h-auto" />
            <div className="p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-2"><CampaignStatusBadge status={c.status} /> {c.status === "active" && <span className="text-sm text-muted">{daysLeftLabel(c.endDate)}</span>}</div>
              <p className="mt-3 text-sm text-muted">Terkumpul (terverifikasi)</p>
              <AnimatedRupiah value={s.collected} className="tabular block text-3xl font-extrabold text-forest md:text-4xl" />
              <Progress value={s.progress} className="mt-3" height="h-3" label="Progres campaign" />
              <div className="mt-2 flex justify-between text-sm">
                <span className="tabular font-bold text-emerald-700">{formatPercent(s.progress)}</span>
                <span className="tabular text-muted">Target {rupiah(c.target)}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-ivory p-2.5"><p className="tabular font-extrabold">{s.contributors}</p><p className="text-xs text-muted">donatur</p></div>
                <div className="rounded-xl bg-amber-50 p-2.5"><p className="tabular font-extrabold text-amber-800">{s.pending.length}</p><p className="text-xs text-amber-800/80">menunggu</p></div>
                <div className="rounded-xl bg-ivory p-2.5"><p className="tabular text-sm font-extrabold">{rupiah(spent)}</p><p className="text-xs text-muted">sudah dipakai</p></div>
              </div>
            </div>
          </div>
        </Card>
        <div className="space-y-3">
          {manage && c.status === "active" && (
            <>
              <Button size="lg" className="w-full" onClick={() => setManual(true)}><Plus className="h-5 w-5" /> Catat donasi manual</Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full border-amber-300 bg-amber-50/60 text-amber-900 hover:bg-amber-50"
                onClick={() => {
                  const d = simulate(c.id);
                  if (d) {
                    toast("Donasi baru masuk (simulasi)", { description: `${d.donorName} — ${rupiah(d.amount)}` });
                    setTab("verifikasi");
                  }
                }}
              >
                <FlaskConical className="h-5 w-5" /> Simulasikan donasi masuk
              </Button>
            </>
          )}
          {c.status !== "draft" && (
            <Card className="p-4">
              <p className="mb-3 text-sm font-bold">Bagikan ke krama</p>
              <ShareActions compact path={`/donasi/${c.slug}`} title={c.title} message={`🙏 ${c.title}\nTerkumpul ${rupiah(s.collected)} dari ${rupiah(c.target)}. Mari berpunia:`} />
            </Card>
          )}
          {c.status === "active" && can("campaign.manage") && (
            <Button variant="ghost" className="w-full text-muted" onClick={() => setClosing("completed")}><Square className="h-4 w-4" /> Tutup penggalangan</Button>
          )}
        </div>
      </div>

      <div className="no-scrollbar -mx-4 mt-6 overflow-x-auto px-4">
        <Segmented
          value={tab}
          onChange={setTab}
          ariaLabel="Bagian campaign"
          options={[
            { value: "ringkasan", label: "Ringkasan" },
            { value: "verifikasi", label: `Verifikasi (${s.pending.length})` },
            { value: "donasi", label: "Semua donasi" },
            { value: "kabar", label: "Kabar" },
          ]}
        />
      </div>

      <div className="mt-4">
        {tab === "ringkasan" && (
          <Card>
            <CardBody className="space-y-4 text-[15px]">
              <p className="leading-relaxed text-charcoal/80">{c.description}</p>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-ivory p-3"><dt className="text-sm text-muted">Penggunaan dana</dt><dd className="font-semibold">{c.purpose}</dd></div>
                <div className="rounded-xl bg-ivory p-3"><dt className="text-sm text-muted">Kegiatan</dt><dd className="font-semibold">{ws.activities.find((a) => a.id === c.activityId)?.name ?? "—"}</dd></div>
                <div className="rounded-xl bg-ivory p-3"><dt className="text-sm text-muted">Rekening</dt><dd className="font-semibold">{ws.accounts.find((a) => a.id === c.accountId)?.name}</dd></div>
                <div className="rounded-xl bg-ivory p-3"><dt className="text-sm text-muted">Verifikasi</dt><dd className="font-semibold">{c.manualVerification ? "Manual oleh bendahara" : "Otomatis"}</dd></div>
              </dl>
              <p className="flex items-start gap-2 rounded-xl bg-mint/50 p-3 text-sm text-emerald-900">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Setiap donasi terverifikasi tercatat sebagai tepat satu transaksi pemasukan di buku kas pura, sehingga tidak ada dana yang terhitung dua kali.
              </p>
            </CardBody>
          </Card>
        )}

        {tab === "verifikasi" && (
          <Card data-tour="pending-donations">
            <CardHeader title="Menunggu verifikasi" description="Cocokkan dengan mutasi rekening atau uang tunai yang diterima sebelum memverifikasi." />
            <div className="p-3">
              <AnimatePresence initial={false}>
                {s.pending.map((d) => (
                  <motion.div key={d.id} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 60 }} className="mb-2 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><HandCoins className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{d.donorName} {d.simulated && <SimulationTag className="ml-1 align-middle" />}</p>
                        <p className="text-sm text-muted">{formatDateShort(d.date)} · {d.channel === "tunai" ? "Tunai" : d.channel === "simulasi" ? "Simulasi" : "Transfer"} · {PRIVACY_LABEL[d.privacy]}</p>
                        {d.message && <p className="mt-1 text-sm italic text-charcoal/70">&ldquo;{d.message}&rdquo;</p>}
                        {d.evidence && <button onClick={() => setEvidence(d)} className="mt-1 text-sm font-semibold text-emerald-700 hover:underline">Lihat bukti transfer</button>}
                      </div>
                      <p className="tabular text-xl font-extrabold">{rupiah(d.amount)}</p>
                    </div>
                    {manage && (
                      <div className="mt-3 flex gap-2">
                        <Button className="flex-1" onClick={() => setVerifying(d)}><CheckCircle2 className="h-4 w-4" /> Verifikasi</Button>
                        <Button variant="outline" className="flex-1 text-expense" onClick={() => { setRejecting(d); setRejectReason(""); }}><XCircle className="h-4 w-4" /> Tolak</Button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {s.pending.length === 0 && <EmptyState icon={CheckCircle2} title="Semua sudah diverifikasi" description="Donasi baru akan muncul di sini." />}
            </div>
          </Card>
        )}

        {tab === "donasi" && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[15px]">
                <thead className="bg-ivory text-sm text-muted">
                  <tr><th className="px-4 py-3 font-semibold">Donatur</th><th className="px-4 py-3 font-semibold">Tanggal</th><th className="px-4 py-3 font-semibold">Privasi</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">Nominal</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {own.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-3 font-semibold">{d.donorName} {d.simulated && <SimulationTag className="ml-1" />}</td>
                      <td className="px-4 py-3 text-muted">{formatDateShort(d.date)}</td>
                      <td className="px-4 py-3 text-sm text-muted">{PRIVACY_LABEL[d.privacy]}</td>
                      <td className="px-4 py-3">
                        {d.status === "verified" && (d.transactionId ? <Link href={`/app/transaksi/${d.transactionId}`}><Badge tone="green" dot>Terverifikasi</Badge></Link> : <Badge tone="green" dot>Terverifikasi</Badge>)}
                        {d.status === "pending" && <Badge tone="amber" dot>Menunggu</Badge>}
                        {d.status === "rejected" && <span title={d.rejectedReason}><Badge tone="red" dot>Ditolak</Badge></span>}
                      </td>
                      <td className="tabular px-4 py-3 text-right font-bold">{rupiah(d.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!own.length && <EmptyState icon={HandCoins} title="Belum ada donasi" />}
          </Card>
        )}

        {tab === "kabar" && (
          <Card>
            <CardHeader title="Kabar untuk donatur" description="Tampil di halaman publik campaign." action={can("campaign.manage") && <Button size="sm" onClick={() => setUpd({ open: true, title: "", body: "" })}><Plus className="h-4 w-4" /> Tambah</Button>} />
            <CardBody>
              {c.updates.length ? (
                <ol className="space-y-4">
                  {c.updates.map((u) => (
                    <li key={u.id} className="rounded-2xl bg-ivory p-4"><p className="text-xs text-muted">{formatDateShort(u.date)}</p><p className="font-bold">{u.title}</p><p className="mt-1 text-charcoal/80">{u.body}</p></li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted">Belum ada kabar.</p>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!verifying}
        onClose={() => setVerifying(null)}
        title="Verifikasi donasi ini?"
        description={verifying && <>Pastikan <strong>{rupiah(verifying.amount)}</strong> dari <strong>{verifying.donorName}</strong> sudah benar-benar diterima. Sistem akan mencatat satu transaksi pemasukan dan memperbarui progres campaign.</>}
        confirmLabel="Ya, sudah diterima"
        onConfirm={() => {
          if (!verifying) return;
          const r = verify(verifying.id);
          setVerifying(null);
          r.ok ? toast.success("Donasi terverifikasi", { description: `Tercatat sebagai ${r.value.number}. Dashboard & halaman publik diperbarui.` }) : toast.error(r.error);
        }}
      />
      <Dialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Tolak donasi"
        description="Donasi yang ditolak tidak dihitung dan tidak tampil di halaman publik."
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setRejecting(null)}>Batal</Button>
            <Button
              variant="danger"
              size="lg"
              className="flex-1"
              disabled={rejectReason.trim().length < 5}
              onClick={() => {
                if (!rejecting) return;
                const r = reject(rejecting.id, rejectReason.trim());
                setRejecting(null);
                r.ok ? toast.success("Donasi ditolak") : toast.error(r.error);
              }}
            >
              Tolak donasi
            </Button>
          </div>
        }
      >
        <Field label="Alasan penolakan" htmlFor="rej" hint="Mis. dana tidak ditemukan di mutasi rekening.">
          <Textarea id="rej" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </Field>
      </Dialog>
      <ConfirmDialog
        open={!!closing}
        onClose={() => setClosing(null)}
        title={closing === "completed" ? "Tutup penggalangan dana?" : "Terbitkan campaign?"}
        description={closing === "completed" ? "Halaman publik tetap ada dengan status Selesai. Donasi yang menunggu masih bisa diverifikasi." : "Campaign akan langsung tampil di portal publik."}
        confirmLabel={closing === "completed" ? "Ya, tutup" : "Ya, terbitkan"}
        onConfirm={() => {
          if (closing) setStatus(c.id, closing);
          toast.success(closing === "completed" ? "Penggalangan ditutup" : "Campaign diterbitkan");
          setClosing(null);
        }}
      />
      <Dialog
        open={upd.open}
        onClose={() => setUpd({ ...upd, open: false })}
        title="Tambah kabar"
        footer={
          <Button
            size="lg"
            className="w-full"
            disabled={upd.title.trim().length < 3 || upd.body.trim().length < 5}
            onClick={() => {
              addUpdate(c.id, { date: todayISO(), title: upd.title.trim(), body: upd.body.trim() });
              setUpd({ open: false, title: "", body: "" });
              toast.success("Kabar dipublikasikan");
            }}
          >
            Publikasikan kabar
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Judul" htmlFor="u-title"><Input id="u-title" value={upd.title} onChange={(e) => setUpd({ ...upd, title: e.target.value })} /></Field>
          <Field label="Isi kabar" htmlFor="u-body"><Textarea id="u-body" rows={4} value={upd.body} onChange={(e) => setUpd({ ...upd, body: e.target.value })} /></Field>
        </div>
      </Dialog>
      <Dialog open={!!evidence} onClose={() => setEvidence(null)} title="Bukti transfer" size="lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {evidence?.evidence && <img src={evidence.evidence} alt="Bukti transfer" className="mx-auto max-h-[70dvh] rounded-xl" />}
      </Dialog>
      <ManualDonationDialog open={manual} onClose={() => setManual(false)} campaignId={c.id} defaultPrivacy={c.defaultPrivacy} />
    </div>
  );
}

const manualSchema = z.object({
  donorName: z.string().trim().min(2, "Isi nama donatur"),
  amount: z.number().min(1_000, "Isi nominal"),
  date: z.string().min(1).refine((d) => d <= todayISO(), "Tanggal tidak boleh di masa depan"),
  channel: z.enum(["transfer", "tunai"]),
  privacy: z.enum(["public", "anonymous", "private"]),
  evidence: z.string().optional(),
  verifyNow: z.boolean(),
  consent: z.literal(true, { errorMap: () => ({ message: "Konfirmasi bahwa pilihan privasi sesuai persetujuan donatur" }) }),
});

function ManualDonationDialog({ open, onClose, campaignId, defaultPrivacy }: { open: boolean; onClose: () => void; campaignId: string; defaultPrivacy: Donation["privacy"] }) {
  const addDonation = useStore((s) => s.addDonation);
  const { register, control, handleSubmit, formState, reset, watch } = useForm<z.infer<typeof manualSchema>>({
    resolver: zodResolver(manualSchema),
    defaultValues: { donorName: "", amount: 0, date: todayISO(), channel: "tunai", privacy: defaultPrivacy, verifyNow: false },
  });
  const verifyNow = watch("verifyNow");
  const onSubmit = handleSubmit((v) => {
    const r = addDonation({ campaignId, donorName: v.donorName, amount: v.amount, date: v.date, channel: v.channel, privacy: v.privacy, evidence: v.evidence, verifyNow: v.verifyNow });
    if (!r.ok) return toast.error(r.error);
    toast.success(v.verifyNow ? "Donasi dicatat & diverifikasi" : "Donasi dicatat, menunggu verifikasi");
    reset();
    onClose();
  });
  return (
    <Dialog open={open} onClose={onClose} title="Catat donasi manual" footer={<Button size="lg" className="w-full" onClick={onSubmit}>{verifyNow ? "Simpan & verifikasi" : "Simpan sebagai menunggu"}</Button>}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Nominal" required error={formState.errors.amount?.message}>
          <Controller control={control} name="amount" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label="Nama donatur" htmlFor="m-name" required error={formState.errors.donorName?.message}><Input id="m-name" {...register("donorName")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal" htmlFor="m-date" error={formState.errors.date?.message}><Input id="m-date" type="date" max={todayISO()} {...register("date")} /></Field>
          <Field label="Diterima melalui" htmlFor="m-ch"><Select id="m-ch" {...register("channel")}><option value="tunai">Tunai</option><option value="transfer">Transfer</option></Select></Field>
        </div>
        <Field label="Privasi (sesuai persetujuan donatur)">
          <Controller control={control} name="privacy" render={({ field }) => <PrivacyPicker value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label="Bukti (opsional)">
          <Controller control={control} name="evidence" render={({ field }) => <ImageUpload value={field.value} onChange={(v) => field.onChange(v)} label="Bukti donasi" compact />} />
        </Field>
        <label className="flex items-start gap-3 rounded-2xl border border-line p-3.5">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-600" {...register("verifyNow")} />
          <span><span className="block font-semibold">Langsung verifikasi</span><span className="block text-sm text-muted">Centang jika uang sudah diterima dan dicek.</span></span>
        </label>
        <label className="flex items-start gap-3 text-[15px]">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-600" {...register("consent")} />
          <span>Pilihan privasi di atas sesuai dengan persetujuan donatur.</span>
        </label>
        {formState.errors.consent && <p className="text-sm font-medium text-expense">{formState.errors.consent.message}</p>}
      </form>
    </Dialog>
  );
}

export default function CampaignAdminPage() {
  return (
    <Suspense>
      <CampaignAdmin />
    </Suspense>
  );
}
