"use client";
import { Info, X } from "lucide-react";
import { useStore } from "@/lib/store";

/** A one-sentence message for the signed-in person (e.g. their profile photo was removed). */
export function NoticeBar() {
  const notice = useStore((s) => s.me?.notice);
  const run = useStore((s) => s.run);
  if (!notice) return null;
  return (
    <div className="no-print fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] flex justify-center px-4">
      <div role="status" className="flex w-full max-w-lg items-start gap-3 rounded-2xl bg-charcoal p-4 text-white shadow-xl">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-gold-light" />
        <p className="min-w-0 flex-1 text-[15px]">{notice}</p>
        <button type="button" aria-label="Tutup pemberitahuan" className="-m-1 rounded-lg p-1 hover:bg-white/10" onClick={() => run("dismissNotice", {})}>
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
