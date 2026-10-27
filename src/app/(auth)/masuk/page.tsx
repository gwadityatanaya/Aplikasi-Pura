"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import { GoogleIcon } from "@/components/shared/auth-bits";

const schema = z.object({ email: z.string().trim().email("Format email belum benar") });

const ERRORS: Record<string, string> = {
  "google-belum-diatur": "Masuk dengan Google belum diatur oleh pengelola.",
  "google-dibatalkan": "Masuk dengan Google dibatalkan.",
  "google-sesi-habis": "Waktu masuk habis. Silakan coba lagi.",
  "google-gagal": "Masuk dengan Google gagal. Silakan coba lagi.",
};

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const requestLink = useStore((s) => s.requestEmailLink);
  const [sent, setSent] = useState<{ email: string; devLink?: string } | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [opts, setOpts] = useState<{ google: boolean; email: boolean; emailDev: boolean } | null>(null);
  const errorCode = params.get("error");
  const { register, handleSubmit, formState, setError } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  useEffect(() => {
    fetch("/api/setup").then((r) => r.json()).then((j) => setSetupNeeded(j.ok && !j.done)).catch(() => {});
    // Email and Google are both optional — only show what the server has set up.
    fetch("/api/auth/options").then((r) => r.json()).then((j) => setOpts(j.ok ? j : { google: true, email: false, emailDev: false })).catch(() => setOpts({ google: true, email: false, emailDev: false }));
  }, []);

  if (sent)
    return (
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-mint text-emerald-700"><MailCheck className="h-8 w-8" /></div>
        <h1 className="mt-5 text-2xl font-extrabold text-forest">Periksa email Anda</h1>
        <p className="mt-2 text-[17px] text-muted">Kami mengirim tautan masuk ke <strong className="text-charcoal">{sent.email}</strong>. Buka email itu lalu ketuk tombol <strong>Masuk ke PURA</strong>. Tautan berlaku 15 menit.</p>
        <p className="mt-3 text-sm text-muted">Tidak ada di Kotak Masuk? Periksa folder <strong>Spam</strong> atau <strong>Promosi</strong>.</p>
        {sent.devLink && (
          <div className="mt-6 rounded-2xl border border-dashed border-gold bg-gold-light/50 p-4 text-left text-sm text-gold-dark">
            <p className="font-bold">Mode pengembangan: email belum diatur.</p>
            <a href={sent.devLink} className={buttonClass("gold", "md", "mt-3 w-full")}>Buka tautan masuk</a>
          </div>
        )}
        <button onClick={() => setSent(null)} className="mt-6 font-semibold text-emerald-700 hover:underline">Pakai email lain</button>
      </div>
    );

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-forest">{params.get("daftar") ? "Daftar / Masuk" : "Masuk"}</h1>
      <p className="mt-2 text-[17px] text-muted">Untuk umat dan pengurus. Belum punya akun? Cukup masuk — akun umat dibuat otomatis.</p>

      {errorCode && <p className="mt-5 rounded-2xl bg-red-50 p-3.5 text-[15px] font-medium text-red-700" role="alert">{ERRORS[errorCode] ?? errorCode}</p>}
      {setupNeeded && (
        <Link href="/setup" className="mt-5 flex items-center gap-3 rounded-2xl border border-gold/50 bg-gold-light/60 p-4 text-gold-dark hover:bg-gold-light">
          <KeyRound className="h-5 w-5 shrink-0" />
          <span className="flex-1 text-sm"><strong>Aplikasi belum disiapkan.</strong> Buat akun Admin Utama terlebih dahulu.</span>
          <ChevronRight className="h-5 w-5" />
        </Link>
      )}

      {!opts ? (
        <div className="mt-7 h-14 animate-pulse rounded-2xl bg-stone-200" />
      ) : (
        <>
          {opts.google && (
            <a href={`/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="press mt-7 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-line bg-white text-[17px] font-bold text-charcoal shadow-soft hover:bg-ivory">
              <GoogleIcon className="h-6 w-6" /> Masuk dengan Google
            </a>
          )}

          {opts.google && opts.email && (
            <div className="my-6 flex items-center gap-3 text-sm text-muted">
              <span className="h-px flex-1 bg-line" /> atau lewat email <span className="h-px flex-1 bg-line" />
            </div>
          )}

          {opts.email && (
          <form
            className={opts.google ? "space-y-4" : "mt-7 space-y-4"}
            noValidate
            onSubmit={handleSubmit(async (v) => {
              const r = await requestLink(v.email, next || undefined);
              if (!r.ok) return setError("email", { message: r.error });
              setSent({ email: v.email, devLink: r.value.devLink });
            })}
          >
            <Field label="Alamat email" htmlFor="email" error={formState.errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="nama@email.com" {...register("email")} />
            </Field>
            <Button type="submit" size="xl" variant="secondary" className="w-full" loading={formState.isSubmitting}>Kirim tautan masuk</Button>
          </form>
          )}
          {!opts.google && !opts.email && (
            <p className="mt-7 rounded-2xl bg-amber-50 p-4 text-[15px] text-amber-900" role="alert">Cara masuk belum diatur oleh pengelola (Google atau email). Hubungi Admin Utama.</p>
          )}
        </>
      )}

      <p className="mt-6 flex items-start gap-2 rounded-2xl bg-mint/60 p-3.5 text-sm text-emerald-900">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Tanpa kata sandi. Pengurus yang sudah didaftarkan Admin Utama otomatis masuk ke dashboard. Lihat <Link href="/kebijakan-privasi" className="font-semibold underline">Kebijakan Privasi</Link>.</span>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
