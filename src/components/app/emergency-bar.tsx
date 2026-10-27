"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { useAccess, useStore } from "@/lib/store";

/**
 * Admin Utama sees every temple in view-only mode. To sahkan, tolak or koreksi records of the open
 * temple, "Mode darurat" must be switched on with a reason (60 minutes, logged, visible to pengurus).
 */
export function EmergencyBar() {
  const access = useAccess();
  const temple = useStore((s) => s.data.temples.find((t) => t.id === s.session?.activeTempleId));
  const run = useStore((s) => s.run);
  const refresh = useStore((s) => s.refresh);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const em = access.emergency;

  // When the hour is up the server already treats the mode as ended; refresh so the screen follows.
  useEffect(() => {
    if (!em) return;
    const ms = new Date(em.until).getTime() - Date.now();
    const t = setTimeout(() => refresh(), Math.max(1000, ms + 1000));
    return () => clearTimeout(t);
  }, [em, refresh]);

  if (!access.isSuperAdmin || !temple) return null;

  async function start() {
    if (reason.trim().length < 10) return toast.error("Tuliskan alasan (minimal 10 huruf).");
    setBusy(true);
    const r = await run("startEmergency", { reason: reason.trim() });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setOpen(false);
    setReason("");
    toast.success("Mode darurat aktif selama 60 menit untuk pura ini.");
  }
  async function stop() {
    const r = await run("endEmergency");
    if (!r.ok) return toast.error(r.error);
    toast.success("Kembali ke mode lihat.");
  }

  return (
    <>
      {em ? (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-red-700 p-4 text-white">
          <Siren className="h-6 w-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">MODE DARURAT aktif di {temple.name} sampai {new Date(em.until).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>
            <p className="text-sm text-white/90">Alasan: {em.reason}. Setiap tindakan tercatat sebagai &quot;dilakukan oleh Admin Utama (mode darurat)&quot; dan terlihat oleh pengurus pura.</p>
          </div>
          <Button variant="light" onClick={stop}>Akhiri mode darurat</Button>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-charcoal p-4 text-white">
          <Eye className="h-6 w-6 shrink-0 text-gold-light" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Mode lihat — Admin Utama</p>
            <p className="text-sm text-white/85">Anda bisa melihat semua data {temple.name}. Untuk mengesahkan, menolak, atau mengoreksi, aktifkan mode darurat.</p>
          </div>
          <Button variant="gold" onClick={() => setOpen(true)}><Siren className="h-4 w-4" /> Mode darurat</Button>
        </div>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Mode darurat — ${temple.name}`}
        description="Gunakan hanya jika pengurus pura dan Pengurus Banjar tidak bisa menangani."
        footer={<Button variant="danger" size="lg" className="w-full" loading={busy} onClick={start}>Aktifkan selama 60 menit</Button>}
      >
        <div className="space-y-3 text-[15px]">
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>Berlaku hanya untuk pura ini, selama 60 menit atau sampai Anda mengakhirinya / pindah pura.</li>
            <li>Alasan dan setiap tindakan tercatat di Log Aktivitas dan di Riwayat Audit Pura (terlihat oleh pengurus pura).</li>
            <li>Aturan tetap berlaku: Anda tidak bisa mengesahkan punia yang Anda kirim sendiri.</li>
          </ul>
          <Field label="Alasan (wajib)" htmlFor="em-reason" required>
            <Textarea id="em-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Mis. Pengurus sedang ke luar daerah, punia odalan perlu segera disahkan" />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
