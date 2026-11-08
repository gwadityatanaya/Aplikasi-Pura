"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Textarea } from "@/components/ui/field";
import { useWorkspace } from "@/components/app/hooks";
import { useStore } from "@/lib/store";
import type { Activity } from "@/lib/types";

/** What is linked to a kegiatan (the server and database check the same before a delete). */
export function useActivityLinks(a: Activity) {
  const ws = useWorkspace();
  const txs = ws.transactions.filter((t) => t.activityId === a.id).length;
  const dons = ws.donations.filter((d) => d.activityId === a.id).length;
  const camps = ws.campaigns.filter((c) => c.activityId === a.id).length;
  return { txs, dons, camps, empty: !txs && !dons && !camps };
}

/** Archive / reactivate / delete buttons for a kegiatan (Pengurus Pura, Pengurus Banjar, Admin Utama in mode darurat). */
export function ActivityArchiveActions({ a }: { a: Activity }) {
  const run = useStore((s) => s.run);
  const router = useRouter();
  const links = useActivityLinks(a);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async (name: string, payload: unknown, msg: string, after?: () => void) => {
    setBusy(true);
    const r = await run(name, payload);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(msg);
    after?.();
  };

  if (a.archivedAt)
    return <Button variant="outline" loading={busy} onClick={() => go("unarchiveActivity", { id: a.id }, "Kegiatan aktif kembali")}><ArchiveRestore className="h-4 w-4" /> Aktifkan kembali</Button>;
  return (
    <>
      <Button variant="outline" onClick={() => { setReason(""); setArchiveOpen(true); }}><Archive className="h-4 w-4" /> Arsipkan</Button>
      {links.empty && <Button variant="ghost" className="text-expense" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Hapus</Button>}
      <Dialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Arsipkan kegiatan?"
        description={a.name}
        footer={<Button size="lg" className="w-full" loading={busy} disabled={reason.trim().length < 5} onClick={() => go("archiveActivity", { id: a.id, reason }, "Kegiatan diarsipkan", () => setArchiveOpen(false))}><Archive className="h-5 w-5" /> Arsipkan kegiatan</Button>}
      >
        <div className="space-y-3">
          <p className="rounded-xl bg-amber-50 p-3 text-[0.9375rem] text-amber-900">
            Kegiatan disembunyikan dari pilihan baru. Semua transaksi, punia, penggalangan dana, dan laporannya <b>tetap ada</b>. Bisa diaktifkan kembali kapan saja.
          </p>
          <Field label="Alasan (wajib)" hint="Dicatat di Log Aktivitas dan Riwayat Audit Pura." htmlFor="act-arsip-alasan">
            <Textarea id="act-arsip-alasan" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      </Dialog>
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        tone="danger"
        title="Hapus kegiatan ini?"
        description={`"${a.name}" belum punya transaksi, punia, atau penggalangan dana, jadi bisa dihapus permanen. Penghapusan tercatat di Log Aktivitas.`}
        confirmLabel="Hapus kegiatan"
        onConfirm={() => go("deleteActivity", { id: a.id }, "Kegiatan dihapus", () => { setDeleteOpen(false); router.push("/app/kegiatan"); })}
      />
    </>
  );
}
