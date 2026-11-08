"use client";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, MessageSquarePlus, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import type { Campaign } from "@/lib/types";

const PUBLIC_WARNING = "Tulisan ini tampil untuk SEMUA orang di halaman publik. Jangan menulis nama orang, nomor HP, nomor rekening, atau data pribadi lainnya.";

/** "Tutup penggalangan" (reason required, public, never editable) and "Tambah catatan" afterwards. */
export function CampaignCloseActions({ campaign, mode }: { campaign: Campaign; mode: "close" | "note" }) {
  const run = useStore((s) => s.run);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const close = mode === "close";

  async function save() {
    setBusy(true);
    const r = await run(close ? "closeCampaign" : "addCampaignCloseNote", close ? { id: campaign.id, reason: text } : { id: campaign.id, text });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(close ? "Penggalangan ditutup" : "Catatan ditambahkan");
    setOpen(false);
  }

  return (
    <>
      {close ? (
        <Button variant="ghost" className="w-full text-muted" onClick={() => { setText(""); setOpen(true); }}><Square className="h-4 w-4" /> Tutup penggalangan</Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => { setText(""); setOpen(true); }}><MessageSquarePlus className="h-4 w-4" /> Tambah catatan</Button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={close ? "Tutup penggalangan sebelum waktunya?" : "Tambah catatan penutupan"}
        description={campaign.title}
        footer={
          <Button size="lg" variant={close ? "danger" : "primary"} className="w-full" loading={busy} disabled={text.trim().length < 5} onClick={save}>
            {close ? "Tutup penggalangan" : "Simpan catatan"}
          </Button>
        }
      >
        <div className="space-y-3">
          {close && (
            <p className="rounded-xl bg-ivory p-3 text-[0.9375rem]">
              Penggalangan tetap tampil di halaman publik dengan tanda <b>Ditutup</b>, tanggal, dan alasannya, tetapi <b>tidak menerima punia baru</b>. Punia yang masih menunggu tetap bisa disahkan atau ditolak. Penutupan tidak bisa dibatalkan, dan <b>alasan tidak bisa diubah</b> setelah disimpan — koreksi lewat catatan tambahan.
            </p>
          )}
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[0.9375rem] font-semibold text-amber-900" role="note">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> {PUBLIC_WARNING}
          </p>
          <Field label={close ? "Alasan penutupan (wajib)" : "Catatan tambahan"} hint="Minimal 5 huruf. Tercatat di Log Aktivitas." htmlFor="close-text">
            <Textarea id="close-text" rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
