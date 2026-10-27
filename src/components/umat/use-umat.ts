"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, useStore } from "@/lib/store";
import type { Donation } from "@/lib/types";

export interface MyPunia extends Donation {
  temple?: { id: string; name: string; slug: string };
}

/** Sends visitors who are not signed in to the login page, then back here. */
export function useRequireLogin() {
  const hydrated = useStore((s) => s.hydrated);
  const me = useStore((s) => s.me);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (hydrated && !me) router.replace(`/masuk?next=${encodeURIComponent(pathname + window.location.search)}`);
  }, [hydrated, me, router, pathname]);
  return { ready: hydrated && !!me, me };
}

/** The signed-in person's own punia, newest first. */
export function useMyPunia(enabled: boolean) {
  const [punia, setPunia] = useState<MyPunia[] | null>(null);
  const [error, setError] = useState<string>();
  const reload = useCallback(async () => {
    const { json } = await api<{ punia: MyPunia[] }>("/api/umat");
    if (json.ok) {
      setPunia(json.punia);
      setError(undefined);
    } else setError(json.error ?? "Gagal memuat riwayat punia.");
  }, []);
  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);
  return { punia, error, reload };
}

export const STATUS_INFO: Record<Donation["status"], { label: string; tone: "amber" | "green" | "red"; desc: string }> = {
  pending: { label: "Menunggu verifikasi", tone: "amber", desc: "Pengurus pura akan mencocokkan bukti dengan rekening pura." },
  verified: { label: "Disahkan", tone: "green", desc: "Sudah disahkan pengurus dan dicatat di kas pura. Suksma!" },
  rejected: { label: "Ditolak", tone: "red", desc: "Lihat alasannya, perbaiki, lalu kirim ulang." },
};
