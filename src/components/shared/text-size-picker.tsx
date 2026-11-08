"use client";
import { toast } from "sonner";
import { Segmented } from "@/components/ui/segmented";
import { useStore } from "@/lib/store";
import type { TextSize } from "@/lib/types";

const OPTIONS: { value: TextSize; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "besar", label: "Besar" },
  { value: "sangat_besar", label: "Sangat besar" },
];

/** Reading size: saved with the account (follows the person to any device), also on this device. */
export function TextSizePicker() {
  const me = useStore((s) => s.me);
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPreferences);
  const updateUser = useStore((s) => s.updateUser);
  const value = me?.textSize ?? prefs.textSize;
  return (
    <div>
      <p className="mb-2 font-semibold" id="ukuran-huruf">Ukuran huruf</p>
      <Segmented
        value={value}
        ariaLabel="Ukuran huruf"
        options={OPTIONS}
        onChange={async (v) => {
          setPrefs({ textSize: v });
          if (me) {
            const r = await updateUser({ textSize: v });
            if (!r.ok) return toast.error(r.error);
          }
          toast.success("Ukuran huruf disimpan");
        }}
      />
      <p className="mt-1 text-sm text-muted">Tersimpan di akun Anda, jadi ikut di HP atau laptop lain.</p>
    </div>
  );
}
