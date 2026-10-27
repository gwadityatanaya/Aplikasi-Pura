"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useStore } from "@/lib/store";

/** For a lost or borrowed phone: ends every session of this account, on all devices. */
export function LogoutEverywhere() {
  const run = useStore((s) => s.run);
  const logout = useStore((s) => s.logout);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-4">
      <div>
        <p className="font-semibold">HP hilang atau pernah masuk di HP orang lain?</p>
        <p className="text-sm text-muted">Keluarkan akun ini dari semua perangkat sekaligus.</p>
      </div>
      <Button variant="outline" onClick={() => setOpen(true)}><MonitorSmartphone className="h-4 w-4" /> Keluar dari semua perangkat</Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={busy}
        title="Keluar dari semua perangkat?"
        description="Anda juga akan keluar dari perangkat ini dan perlu masuk lagi."
        confirmLabel="Ya, keluar semua"
        onConfirm={async () => {
          setBusy(true);
          const r = await run("logoutEverywhere");
          setBusy(false);
          if (!r.ok) return toast.error(r.error);
          await logout();
          toast.success("Akun sudah keluar dari semua perangkat.");
          router.replace("/masuk");
        }}
      />
    </div>
  );
}
