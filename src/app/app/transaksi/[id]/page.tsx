"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, FileX2, History, ImageOff, Link2, Pencil, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { CategoryIcon, TxAmount, TxStatusBadges } from "@/components/app/tx-row";
import { useCan, useWorkspace } from "@/components/app/hooks";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { formatDateLong, formatDateTime } from "@/lib/format";

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ws = useWorkspace();
  const can = useCan();
  const confirmDraft = useStore((s) => s.confirmDraft);
  const deleteDraft = useStore((s) => s.deleteDraft);
  const reverse = useStore((s) => s.reverseTransaction);
  const [dlg, setDlg] = useState<"confirm" | "delete" | "reverse" | "receipt" | null>(null);
  const [reason, setReason] = useState("");
  const [reasonErr, setReasonErr] = useState("");
  const tx = ws.transactions.find((t) => t.id === id);

  if (!tx)
    return <Card><EmptyState icon={FileX2} title="Transaksi tidak ditemukan" description="Mungkin draf ini sudah dihapus, atau milik pura lain." action={<Link href="/app/transaksi" className={buttonClass("primary")}>Ke daftar transaksi</Link>} /></Card>;

  const cat = ws.categories.find((c) => c.id === tx.categoryId);
  const acc = ws.accounts.find((a) => a.id === tx.accountId);
  const toAcc = ws.accounts.find((a) => a.id === tx.toAccountId);
  const act = ws.activities.find((a) => a.id === tx.activityId);
  const campaign = ws.campaigns.find((c) => c.id === tx.campaignId);
  const donation = ws.donations.find((d) => d.id === tx.donationId);
  const reversal = ws.transactions.find((t) => t.id === tx.reversedBy);
  const original = ws.transactions.find((t) => t.id === tx.reversalOf);
  const creator = ws.users.find((u) => u.id === tx.createdBy);
  const history = ws.audit.filter((a) => a.entityId === tx.id || (tx.reversedBy && a.entityId === tx.reversedBy));
  const canReverse = can("tx.reverse") && tx.status === "confirmed" && !tx.reversedBy && !tx.reversalOf && !tx.donationId;

  const rows: [string, React.ReactNode][] = [
    ["Nomor", <span key="n" className="tabular">{tx.number}</span>],
    ["Tanggal", formatDateLong(tx.date)],
    ["Jenis", tx.type === "income" ? "Pemasukan" : tx.type === "expense" ? "Pengeluaran" : "Pindah dana (internal)"],
  ];
  if (cat) rows.push(["Kategori", cat.name]);
  rows.push([tx.type === "transfer" ? "Dari" : "Kas / rekening", acc?.name ?? "—"]);
  if (toAcc) rows.push(["Ke", toAcc.name]);
  if (act) rows.push(["Kegiatan", <Link key="a" className="font-semibold text-emerald-700 hover:underline" href={`/app/kegiatan/${act.id}`}>{act.name}{act.fundType === "restricted" ? " · dana khusus" : ""}</Link>]);
  if (campaign) rows.push(["Campaign", <Link key="c" className="font-semibold text-emerald-700 hover:underline" href={`/app/campaign/${campaign.id}`}>{campaign.title}</Link>]);
  if (tx.source) rows.push(["Sumber", tx.source]);
  if (tx.notes) rows.push(["Catatan", tx.notes]);
  rows.push(["Dicatat oleh", `${creator?.name ?? "—"} · ${formatDateTime(tx.createdAt)}`]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Detail transaksi" back={{ href: "/app/transaksi", label: "Transaksi" }} />
      <Card className="overflow-hidden">
        <div className="flex flex-col items-center bg-ivory/80 px-5 py-8 text-center">
          <CategoryIcon tx={tx} category={cat} size="lg" />
          <p className="mt-3 text-[15px] font-semibold text-charcoal">{tx.description}</p>
          <TxAmount tx={tx} className="mt-1 text-4xl" />
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {tx.status === "confirmed" && !tx.reversedBy && !tx.reversalOf && <Badge tone="green" dot>Terkonfirmasi</Badge>}
            <TxStatusBadges tx={tx} />
            {donation && <Badge tone="emerald">Dari donasi terverifikasi</Badge>}
          </div>
        </div>
        <dl className="divide-y divide-line px-5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-4 py-3 text-[15px]">
              <dt className="w-32 shrink-0 text-muted">{k}</dt>
              <dd className="min-w-0 flex-1 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {(reversal || original) && (
          <div className="mx-5 mb-5 flex items-start gap-3 rounded-2xl bg-stone-50 p-4 text-sm">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            {reversal && <p>Transaksi ini telah dibatalkan oleh entri koreksi <Link className="font-semibold text-emerald-700 hover:underline" href={`/app/transaksi/${reversal.id}`}>{reversal.number}</Link>. Keduanya tetap tersimpan untuk jejak audit, dan pengaruhnya pada saldo saling meniadakan.</p>}
            {original && <p>Entri ini membatalkan <Link className="font-semibold text-emerald-700 hover:underline" href={`/app/transaksi/${original.id}`}>{original.number} — {original.description}</Link>.</p>}
          </div>
        )}
        <div className="flex flex-wrap gap-2 border-t border-line bg-ivory/50 p-4">
          {tx.status === "draft" && can("tx.confirm") && <Button size="lg" onClick={() => setDlg("confirm")}><CheckCircle2 className="h-5 w-5" /> Konfirmasi</Button>}
          {tx.status === "draft" && (can("tx.create") || can("tx.draft")) && (
            <Link href={`/app/transaksi/baru?edit=${tx.id}`} className={buttonClass("outline", "lg")}><Pencil className="h-4 w-4" /> Ubah draf</Link>
          )}
          {tx.status === "draft" && (can("tx.create") || can("tx.draft")) && <Button variant="ghost" size="lg" className="text-expense" onClick={() => setDlg("delete")}><Trash2 className="h-4 w-4" /> Hapus draf</Button>}
          {canReverse && <Button variant="outline" size="lg" onClick={() => setDlg("reverse")}><Undo2 className="h-4 w-4" /> Buat koreksi</Button>}
          {tx.status === "confirmed" && !canReverse && !tx.reversalOf && !tx.reversedBy && (
            <p className="text-sm text-muted">{tx.donationId ? "Transaksi dari donasi dikelola lewat halaman campaign." : "Transaksi terkonfirmasi tidak dapat diubah atau dihapus."}</p>
          )}
        </div>
      </Card>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader title="Bukti / nota" />
          <CardBody>
            {tx.receipt ? (
              <button onClick={() => setDlg("receipt")} className="block w-full overflow-hidden rounded-2xl border border-line" aria-label="Perbesar nota">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tx.receipt} alt={`Nota ${tx.description}`} className="max-h-72 w-full object-cover" />
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">
                <ImageOff className="h-8 w-8" /> Tidak ada bukti terlampir
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Riwayat" description="Jejak audit transaksi ini" />
          <CardBody>
            {history.length ? (
              <ol className="space-y-4">
                {history.map((h) => (
                  <li key={h.id} className="flex gap-3 text-sm">
                    <History className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <div>
                      <p className="font-semibold">{h.action}</p>
                      <p className="text-muted">{h.actorName} · {formatDateTime(h.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">Dicatat oleh {creator?.name} pada {formatDateTime(tx.createdAt)}.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={dlg === "confirm"}
        onClose={() => setDlg(null)}
        title="Konfirmasi transaksi ini?"
        description="Setelah dikonfirmasi, transaksi masuk ke saldo dan tidak bisa diubah lagi. Kesalahan diperbaiki dengan entri koreksi."
        confirmLabel="Ya, konfirmasi"
        onConfirm={async () => {
          const r = await confirmDraft(tx.id);
          setDlg(null);
          r.ok ? toast.success("Transaksi dikonfirmasi") : toast.error(r.error);
        }}
      />
      <ConfirmDialog
        open={dlg === "delete"}
        onClose={() => setDlg(null)}
        tone="danger"
        title="Hapus draf ini?"
        description="Draf belum mempengaruhi saldo, jadi aman untuk dihapus. Penghapusan tetap tercatat di riwayat audit."
        confirmLabel="Hapus draf"
        onConfirm={async () => {
          const r = await deleteDraft(tx.id);
          setDlg(null);
          if (r.ok) {
            toast.success("Draf dihapus");
            router.push("/app/transaksi");
          } else toast.error(r.error);
        }}
      />
      <Dialog
        open={dlg === "reverse"}
        onClose={() => setDlg(null)}
        title="Buat entri koreksi"
        description="Transaksi asli tidak dihapus. Sistem membuat entri baru yang membatalkan pengaruhnya pada saldo."
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setDlg(null)}>Batal</Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={async () => {
                if (reason.trim().length < 5) return setReasonErr("Tuliskan alasan koreksi (min. 5 huruf)");
                const r = await reverse(tx.id, reason.trim());
                setDlg(null);
                if (r.ok) {
                  toast.success(`Koreksi ${r.value.number} dibuat`, { description: "Saldo telah disesuaikan." });
                  router.push(`/app/transaksi/${r.value.id}`);
                } else toast.error(r.error);
              }}
            >
              Buat koreksi
            </Button>
          </div>
        }
      >
        <Field label="Alasan koreksi" htmlFor="reason" error={reasonErr} hint="Contoh: Nota tercatat dua kali, nominal salah ketik.">
          <Textarea id="reason" value={reason} onChange={(e) => { setReason(e.target.value); setReasonErr(""); }} rows={3} />
        </Field>
        <p className="mt-3 text-sm text-muted">Jika nominal salah, buat koreksi lalu catat ulang transaksi dengan nominal yang benar.</p>
      </Dialog>
      <Dialog open={dlg === "receipt"} onClose={() => setDlg(null)} title="Bukti / nota" size="xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {tx.receipt && <img src={tx.receipt} alt={`Nota ${tx.description}`} className="mx-auto max-h-[75dvh] rounded-xl" />}
      </Dialog>
    </div>
  );
}
