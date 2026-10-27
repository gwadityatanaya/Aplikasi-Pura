"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckCircle2, Crown, Settings2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PageSkeleton } from "@/components/ui/skeleton";
import { PasswordInput, SecureNote, StrengthBar } from "@/components/shared/auth-bits";
import { useStore } from "@/lib/store";

const schema = z
  .object({
    token: z.string().trim().min(16, "Kode setup minimal 16 karakter"),
    name: z.string().trim().min(3, "Tulis nama lengkap"),
    email: z.string().trim().email("Format email belum benar"),
    password: z.string().min(10, "Untuk Admin Utama, minimal 10 karakter").regex(/\d/, "Sertakan angka").regex(/[A-Za-z]/, "Sertakan huruf"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Kata sandi tidak sama", path: ["confirm"] });

export default function SetupPage() {
  const router = useRouter();
  const setupAdmin = useStore((s) => s.setupAdmin);
  const [status, setStatus] = useState<{ done: boolean; configured: boolean } | null>(null);
  const { register, handleSubmit, formState, watch, setError } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  useEffect(() => {
    fetch("/api/setup").then((r) => r.json()).then((j) => setStatus({ done: j.done, configured: j.configured })).catch(() => setStatus({ done: false, configured: false }));
  }, []);

  if (!status) return <PageSkeleton />;
  if (status.done)
    return (
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-mint text-emerald-700"><CheckCircle2 className="h-8 w-8" /></div>
        <h1 className="mt-5 text-2xl font-extrabold text-forest">Setup sudah selesai</h1>
        <p className="mt-2 text-[17px] text-muted">Akun Admin Utama sudah ada. Halaman ini terkunci permanen.</p>
        <Link href="/masuk" className={buttonClass("primary", "xl", "mt-7 w-full")}>Ke halaman masuk</Link>
      </div>
    );
  if (!status.configured)
    return (
      <div>
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gold-light text-gold-dark"><Settings2 className="h-7 w-7" /></div>
        <h1 className="mt-5 text-2xl font-extrabold text-forest">Setup belum dikonfigurasi</h1>
        <p className="mt-2 text-[17px] text-muted">
          Isi <code className="rounded bg-stone-100 px-1.5">SETUP_TOKEN</code> (minimal 16 karakter acak) dan <code className="rounded bg-stone-100 px-1.5">ADMIN_EMAIL</code> di file <code>.env</code> atau di pengaturan Environment Variables Vercel, lalu muat ulang halaman ini. Lihat panduan di <code>docs/PANDUAN.md</code>.
        </p>
      </div>
    );

  return (
    <div>
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-charcoal text-gold-light"><Crown className="h-7 w-7" /></div>
      <h1 className="mt-5 text-3xl font-extrabold text-forest">Buat Akun Admin Utama</h1>
      <p className="mt-2 text-[17px] text-muted">Langkah ini hanya bisa dilakukan <strong>satu kali</strong>. Masukkan kode setup dari pengaturan server (SETUP_TOKEN) dan email yang sama dengan ADMIN_EMAIL.</p>
      <form
        className="mt-7 space-y-4"
        noValidate
        onSubmit={handleSubmit(async (v) => {
          const r = await setupAdmin({ token: v.token, name: v.name, email: v.email, password: v.password });
          if (!r.ok) return setError("token", { message: r.error });
          toast.success("Admin Utama berhasil dibuat");
          router.push("/onboarding");
        })}
      >
        <Field label="Kode setup (SETUP_TOKEN)" htmlFor="token" error={formState.errors.token?.message}>
          <PasswordInput id="token" autoComplete="off" {...register("token")} />
        </Field>
        <Field label="Nama lengkap" htmlFor="name" error={formState.errors.name?.message}><Input id="name" autoComplete="name" {...register("name")} /></Field>
        <Field label="Email Admin Utama" htmlFor="email" error={formState.errors.email?.message}><Input id="email" type="email" autoComplete="username" {...register("email")} /></Field>
        <Field label="Kata sandi" htmlFor="password" error={formState.errors.password?.message} hint="Minimal 10 karakter, berisi huruf dan angka. Jangan pakai kata sandi yang sama dengan akun lain.">
          <PasswordInput id="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <StrengthBar password={watch("password") ?? ""} />
        <Field label="Ulangi kata sandi" htmlFor="confirm" error={formState.errors.confirm?.message}><PasswordInput id="confirm" autoComplete="new-password" {...register("confirm")} /></Field>
        <Button type="submit" size="xl" className="w-full" loading={formState.isSubmitting}>Buat Admin Utama</Button>
      </form>
      <div className="mt-6"><SecureNote /></div>
    </div>
  );
}
