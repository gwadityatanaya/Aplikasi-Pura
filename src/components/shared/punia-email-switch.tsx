"use client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useSignInOptions } from "@/lib/sign-in-options";
import { useStore } from "@/lib/store";

/** "Email konfirmasi punia" on/off — for umat (Akun saya) and pengurus (Pengaturan → Notifikasi). */
export function PuniaEmailSwitch() {
  const me = useStore((s) => s.me);
  const updateUser = useStore((s) => s.updateUser);
  const opts = useSignInOptions();
  const off = opts?.puniaEmail === false;
  return (
    <Switch
      checked={!off && me?.emailPunia !== false}
      disabled={off}
      onChange={async (v) => {
        const r = await updateUser({ emailPunia: v });
        if (r.ok) toast.success(v ? "Email konfirmasi punia dinyalakan" : "Email konfirmasi punia dimatikan");
        else toast.error(r.error);
      }}
      label="Email konfirmasi punia"
      description={
        off
          ? "Tidak aktif: layanan email belum diatur oleh pengelola. Status punia tetap terlihat di Punia Saya."
          : "Email saat punia yang Anda kirim lewat aplikasi disahkan atau ditolak. Status punia tetap terlihat di Punia Saya meski email dimatikan."
      }
    />
  );
}
