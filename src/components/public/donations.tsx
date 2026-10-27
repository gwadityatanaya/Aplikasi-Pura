"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EyeOff, HandHeart, Lock, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { MoneyInput, QuickAmounts } from "@/components/ui/money-input";
import { ImageUpload } from "@/components/ui/file-upload";
import { useStore } from "@/lib/store";
import { cn, formatDateShort, initials, relativeTime, rupiah, todayISO } from "@/lib/format";
import type { Campaign, Donation, DonorPrivacy } from "@/lib/types";

/** Name shown publicly, honouring the donor's explicit consent. */
export function publicDonorName(d: Donation) {
  if (d.privacy === "public") return d.donorName;
  return "Anonim";
}

export function DonorList({ donations, limit = 8 }: { donations: Donation[]; limit?: number }) {
  const [showAll, setShowAll] = useState(false);
  const verified = useMemo(
    () => donations.filter((d) => d.status === "verified").sort((a, b) => (b.verifiedAt ?? b.date).localeCompare(a.verifiedAt ?? a.date)),
    [donations]
  );
  const visible = verified.filter((d) => d.privacy !== "private");
  const privateCount = verified.filter((d) => d.privacy === "private").reduce((n, d) => n + (d.count ?? 1), 0);
  const privateSum = verified.filter((d) => d.privacy === "private").reduce((s, d) => s + d.amount, 0);
  const list = showAll ? visible : visible.slice(0, limit);

  if (!verified.length)
    return <p className="py-8 text-center text-[15px] text-muted">Belum ada donasi terverifikasi. Jadilah yang pertama berpunia.</p>;

  return (
    <div>
      <ul className="divide-y divide-line">
        <AnimatePresence initial={false}>
          {list.map((d) => (
            <motion.li
              key={d.id}
              layout
              initial={{ opacity: 0, y: -8, backgroundColor: "#DDF5EC" }}
              animate={{ opacity: 1, y: 0, backgroundColor: "rgba(255,255,255,0)" }}
              transition={{ duration: 0.8 }}
              className="flex items-center gap-3 py-3"
            >
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold",
                  d.privacy === "public" ? "bg-mint text-emerald-800" : "bg-stone-100 text-stone-500"
                )}
                aria-hidden
              >
                {d.privacy === "public" ? initials(d.donorName) || <UserRound className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-charcoal">{publicDonorName(d)}</p>
                <p className="text-xs text-muted">
                  {formatDateShort(d.date)}
                </p>
              </div>
              <p className="tabular font-bold text-charcoal">{rupiah(d.amount)}</p>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {visible.length > limit && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-2 w-full rounded-xl py-3 text-sm font-semibold text-emerald-700 hover:bg-mint/60">
          {showAll ? "Tampilkan lebih sedikit" : `Lihat semua ${visible.length} donatur`}
        </button>
      )}
      {privateCount > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-stone-50 p-3 text-sm text-muted">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {privateCount} donatur memilih tidak ditampilkan. Punia mereka sebesar {rupiah(privateSum)} tetap termasuk dalam total terkumpul.
        </p>
      )}
    </div>
  );
}

export function DonationFeed({ donations }: { donations: Donation[] }) {
  const items = useMemo(
    () =>
      donations
        .filter((d) => d.status === "verified" && !d.count)
        .sort((a, b) => (b.verifiedAt ?? b.createdAt).localeCompare(a.verifiedAt ?? a.createdAt))
        .slice(0, 6),
    [donations]
  );
  return (
    <ul className="space-y-3" aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((d) => (
          <motion.li
            key={d.id + d.status}
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-3"
          >
            <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", d.status === "verified" ? "bg-mint text-emerald-700" : "bg-amber-50 text-amber-700")}>
              <HandHeart className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 text-sm">
              <p className="text-charcoal">
                <span className="font-semibold">{d.privacy === "private" ? "Seorang donatur" : publicDonorName(d)}</span>{" "}
                {d.privacy === "private" ? "berpunia" : <>berpunia <span className="font-semibold">{rupiah(d.amount)}</span></>}
              </p>
              <p className="text-xs text-muted">
                {d.status === "verified" ? `Terverifikasi · ${relativeTime(d.verifiedAt ?? d.createdAt)}` : "Menunggu verifikasi pengurus"}
              </p>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

const privacyOptions: { value: DonorPrivacy; title: string; desc: string }[] = [
  { value: "public", title: "TAMPIL — tampilkan nama", desc: "Nama muncul di daftar punia pura." },
  { value: "anonymous", title: "ANONIM — sembunyikan nama", desc: "Ditampilkan sebagai \"Anonim\". Nama asli hanya diketahui pengurus." },
];

export function PrivacyPicker({ value, onChange }: { value: DonorPrivacy; onChange: (v: DonorPrivacy) => void }) {
  return (
    <div role="radiogroup" aria-label="Pilihan privasi donatur" className="grid gap-2">
      {privacyOptions.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === o.value}
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "press flex items-start gap-3 rounded-2xl border p-3.5 text-left",
            value === o.value ? "border-emerald-500 bg-mint/50 ring-2 ring-emerald-500/20" : "border-line bg-white hover:border-emerald-300"
          )}
        >
          <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", value === o.value ? "border-emerald-600" : "border-stone-300")}>
            {value === o.value && <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />}
          </span>
          <span>
            <span className="block font-semibold text-charcoal">{o.title}</span>
            <span className="block text-sm text-muted">{o.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

