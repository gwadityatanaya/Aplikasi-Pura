"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LinkIcon, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonClass } from "@/components/ui/button";
import { useStore } from "@/lib/store";

/**
 * The email link opens this page; signing in needs one tap. (Email scanners that open links
 * automatically therefore cannot use up the one-time link.)
 */
function UseLink() {
  const params = useSearchParams();
  const router = useRouter();
  const consume = useStore((s) => s.consumeEmailLink);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const token = params.get("token") ?? "";
  const next = params.get("next");

  if (error)
    return (
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-expense"><LinkIcon className="h-8 w-8" /></div>
        <h1 className="mt-5 text-2xl font-extrabold text-forest">Tautan tidak berlaku</h1>
        <p className="mt-2 text-[17px] text-muted">{error}</p>
        <Link href="/masuk" className={buttonClass("primary", "xl", "mt-7 w-full")}>Minta tautan baru</Link>
      </div>
    );

  return (
    <div className="text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-mint text-emerald-700"><LogIn className="h-8 w-8" /></div>
      <h1 className="mt-5 text-2xl font-extrabold text-forest">Masuk ke PURA</h1>
      <p className="mt-2 text-[17px] text-muted">Ketuk tombol di bawah untuk melanjutkan.</p>
      <Button
        size="xl"
        className="mt-7 w-full"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          const r = await consume(token);
          setBusy(false);
          if (!r.ok) return setError(r.error);
          toast.success("Berhasil masuk");
          router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : r.value.next ?? "/umat");
        }}
      >
        Masuk sekarang
      </Button>
    </div>
  );
}

export default function UseLinkPage() {
  return (
    <Suspense>
      <UseLink />
    </Suspense>
  );
}
