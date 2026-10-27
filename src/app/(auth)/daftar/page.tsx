"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput, SecureNote, StrengthBar } from "@/components/shared/auth-bits";
import { useStore } from "@/lib/store";

const schema = z
  .object({
    name: z.string().trim().min(3, "Tulis nama lengkap Anda"),
    email: z.string().trim().email("Format email belum benar"),
    password: z.string().min(8, "Minimal 8 karakter").regex(/\d/, "Sertakan minimal satu angka").regex(/[A-Za-z]/, "Sertakan minimal satu huruf"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Kata sandi tidak sama", path: ["confirm"] });

export default function RegisterPage() {
  const router = useRouter();
  const registerUser = useStore((s) => s.register);
  const [open, setOpen] = useState<boolean | null>(null);
  const { register, handleSubmit, formState, watch, setError } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  useEffect(() => {
    fetch("/api/state").then((r) => r.json()).then((j) => setOpen(j.state ? j.state.registrationOpen : !!j.registrationOpen)).catch(() => setOpen(false));
  }, []);

  const onSubmit = handleSubmit(async (v) => {
    const r = await registerUser({ name: v.name, email: v.email, password: v.password });
    if (!r.ok) return setError("email", { message: r.error });
    toast.success("Akun berhasil dibuat", { description: "Sekarang lengkapi data pura Anda." });
    router.push("/onboarding");
  });

  if (open === false)
    return (
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-mint text-emerald-700"><Lock className="h-8 w-8" /></div>
        <h1 className="mt-5 text-2xl font-extrabold text-forest">Pendaftaran melalui Admin Utama</h1>
        <p className="mt-2 text-[17px] text-muted">Untuk menjaga keamanan data pura, akun pengurus dibuat oleh Admin Utama atau Ketua pura. Hubungi mereka untuk mendapatkan tautan aktivasi.</p>
        <Link href="/masuk" className={buttonClass("primary", "xl", "mt-7 w-full")}>Kembali ke halaman masuk</Link>
      </div>
    );

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-forest">Buat Akun Pengurus</h1>
      <p className="mt-2 text-[17px] text-muted">Langkah 1 dari 2 — setelah ini Anda akan mendaftarkan pura. Pura baru tampil di publik setelah disetujui Admin Utama.</p>
      <form className="mt-7 space-y-4" onSubmit={onSubmit} noValidate>
        <Field label="Nama lengkap" htmlFor="name" error={formState.errors.name?.message}>
          <Input id="name" autoComplete="name" placeholder="I Made …" {...register("name")} />
        </Field>
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Kata sandi" htmlFor="password" error={formState.errors.password?.message} hint="Minimal 8 karakter, berisi huruf dan angka">
          <PasswordInput id="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <StrengthBar password={watch("password") ?? ""} />
        <Field label="Ulangi kata sandi" htmlFor="confirm" error={formState.errors.confirm?.message}>
          <PasswordInput id="confirm" autoComplete="new-password" {...register("confirm")} />
        </Field>
        <Button type="submit" size="xl" className="w-full" loading={formState.isSubmitting} disabled={open === null}>Buat Akun</Button>
      </form>
      <div className="mt-6"><SecureNote /></div>
      <p className="mt-6 text-center text-[15px] text-muted">Sudah punya akun? <Link href="/masuk" className="font-semibold text-emerald-700 hover:underline">Masuk</Link></p>
    </div>
  );
}
