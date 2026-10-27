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
import { PasswordInput } from "@/components/shared/auth-bits";
import { useStore } from "@/lib/store";

const schema = z
  .object({
    token: z.string().trim().min(16, "Kode setup minimal 16 karakter"),
    name: z.string().trim().min(3, "Tulis nama lengkap"),
    email: z.string().trim().email("Format email belum benar"),
  });

export default function SetupPage() {
  const router = useRouter();
  const setupAdmin = useStore((s) => s.setupAdmin);
  const [status, setStatus] = useState<{ done: boolean; configured: boolean } | null>(null);
  const { register, handleSubmit, formState, setError } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
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
      <p className="mt-2 text-[17px] text-muted">Langkah ini hanya bisa dilakukan <strong>satu kali</strong>. Masukkan kode setup dari pengaturan server (SETUP_TOKEN) dan email yang sama dengan ADMIN_EMAIL. Email dicocokkan tanpa membedakan huruf besar-kecil.</p>
      <form
        className="mt-7 space-y-4"
        noValidate
        onSubmit={handleSubmit(async (v) => {
          const r = await setupAdmin({ token: v.token, name: v.name, email: v.email });
          if (!r.ok) return setError("token", { message: r.error });
          toast.success("Admin Utama berhasil dibuat");
          router.push("/app/admin");
        })}
      >
        <Field label="Kode setup (SETUP_TOKEN)" htmlFor="token" error={formState.errors.token?.message}>
          <PasswordInput id="token" autoComplete="off" {...register("token")} />
        </Field>
        <Field label="Nama lengkap" htmlFor="name" error={formState.errors.name?.message}><Input id="name" autoComplete="name" {...register("name")} /></Field>
        <Field label="Email Admin Utama" htmlFor="email" error={formState.errors.email?.message}><Input id="email" type="email" autoComplete="username" {...register("email")} /></Field>
        <Button type="submit" size="xl" className="w-full" loading={formState.isSubmitting}>Buat Admin Utama</Button>
      </form>
      <p className="mt-6 rounded-2xl bg-mint/60 p-3.5 text-sm text-emerald-900">Tidak ada kata sandi. Setelah ini, Admin Utama masuk dengan <strong>Google</strong> atau <strong>tautan email</strong> memakai email di atas.</p>
    </div>
  );
}
