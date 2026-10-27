"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

export type ArchiveAction = "archive" | "unarchive" | "delete";
export interface ArchiveTarget {
  kind: "temple" | "banjar";
  action: ArchiveAction;
  id: string;
  name: string;
  /** Punia still waiting for verification (archiving a temple leaves them unverifiable) */
  pending?: number;
}

/** Command name for each kind + action (all Admin Utama only, checked on the server). */
export const ARCHIVE_COMMAND: Record<ArchiveTarget["kind"], Record<ArchiveAction, string>> = {
  temple: { archive: "archiveTemple", unarchive: "unarchiveTemple", delete: "deleteTemple" },
  banjar: { archive: "archiveBanjar", unarchive: "unarchiveBanjar", delete: "deleteBanjar" },
};

const TEXT: Record<ArchiveTarget["kind"], Record<ArchiveAction, { title: string; button: string; points: string[] }>> = {
  temple: {
    archive: {
      title: "Arsipkan pura",
      button: "Arsipkan pura",
      points: [
        "Pura disembunyikan dari daftar & pencarian publik. Halaman publiknya menampilkan \"Pura tidak tersedia\".",
        "Tidak bisa menerima punia atau transaksi baru. Pengurus hanya bisa melihat data dan mengunduh laporan.",
        "Semua data tetap ada: laporan, Riwayat Audit Pura, dan Log Aktivitas.",
        "Bisa diaktifkan kembali kapan saja.",
      ],
    },
    unarchive: {
      title: "Aktifkan kembali pura",
      button: "Aktifkan kembali",
      points: ["Pura tampil lagi di halaman publik dan bisa menerima punia serta transaksi baru."],
    },
    delete: {
      title: "Hapus pura permanen",
      button: "Hapus permanen",
      points: [
        "Hanya bisa untuk pura yang benar-benar kosong: belum ada transaksi, punia, kegiatan, campaign, laporan terbit, atau foto/nota.",
        "Peran Pengurus Pura dan Pemeriksa di pura ini dicabut.",
        "Tidak bisa dibatalkan. Catatan di Log Aktivitas tetap ada.",
        "Jika pura sudah punya data, gunakan Arsipkan.",
      ],
    },
  },
  banjar: {
    archive: {
      title: "Arsipkan banjar",
      button: "Arsipkan banjar",
      points: [
        "Banjar disembunyikan dari halaman publik, dan Pengurus Banjar-nya kehilangan akses sampai diaktifkan kembali.",
        "Pura yang diempon tetap berjalan seperti biasa — termasuk pura yang juga diempon banjar lain.",
        "Bisa diaktifkan kembali kapan saja.",
      ],
    },
    unarchive: {
      title: "Aktifkan kembali banjar",
      button: "Aktifkan kembali",
      points: ["Banjar tampil lagi, dan Pengurus Banjar-nya mendapat akses kembali."],
    },
    delete: {
      title: "Hapus banjar permanen",
      button: "Hapus permanen",
      points: [
        "Hanya bisa untuk banjar yang tidak mengempon pura satu pun. Jika masih ada pura, gunakan Arsipkan.",
        "Peran Pengurus Banjar di banjar ini dicabut.",
        "Tidak bisa dibatalkan. Catatan di Log Aktivitas tetap ada.",
      ],
    },
  },
};

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Confirmation for archive / reactivate / permanent delete: type the name again + a reason. */
export function ArchiveDialog({ target, busy, onClose, onConfirm }: { target: ArchiveTarget | null; busy: boolean; onClose: () => void; onConfirm: (t: ArchiveTarget, input: { confirmName: string; reason: string }) => void }) {
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    setTyped("");
    setReason("");
  }, [target]);
  const t = target ? TEXT[target.kind][target.action] : null;
  const ok = !!target && norm(typed) === norm(target.name) && reason.trim().length >= 5;
  const danger = target?.action === "delete";
  const Icon = target?.action === "unarchive" ? ArchiveRestore : danger ? Trash2 : Archive;
  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title={t?.title}
      description={target?.name}
      footer={
        <Button size="lg" variant={danger ? "danger" : "primary"} className="w-full" disabled={!ok || busy} onClick={() => target && onConfirm(target, { confirmName: typed, reason })}>
          <Icon className="h-5 w-5" /> {t?.button}
        </Button>
      }
    >
      {target && t && (
        <div className="space-y-4">
          <div className={danger ? "rounded-xl bg-red-50 p-3 text-[15px] text-red-900" : "rounded-xl bg-amber-50 p-3 text-[15px] text-amber-900"}>
            <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5 shrink-0" /> Yang akan terjadi</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">{t.points.map((p) => <li key={p}>{p}</li>)}</ul>
            {target.action === "archive" && !!target.pending && (
              <p className="mt-2 font-bold">Masih ada {target.pending} punia menunggu verifikasi. Sebaiknya selesaikan dulu: setelah diarsipkan, punia itu tidak bisa disahkan atau ditolak.</p>
            )}
          </div>
          <Field label="Alasan (wajib)" hint="Dicatat di Log Aktivitas." htmlFor="arsip-alasan">
            <Textarea id="arsip-alasan" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label={`Ketik nama "${target.name}" untuk konfirmasi`} htmlFor="arsip-nama">
            <Input id="arsip-nama" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
        </div>
      )}
    </Dialog>
  );
}
