"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { KeyRound, LinkIcon } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PageSkeleton } from "@/components/ui/skeleton";
import { PasswordInput, SecureNote, StrengthBar } from "@/components/shared/auth-bits";
import { useStore } from "@/lib/store";

const schema = z
  .object({ password: z.string().min(8, "Minimal 8 karakter").regex(/\d/, "Sertakan minimal satu angka").regex(/[A-Za-z]/, "Sertakan minimal satu huruf"), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Kata sandi tidak sama", path: ["confirm"] });

type Info = { valid: boolean; purpose?: "activation" | "reset"; name?: string; email?: string };

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const reset = useStore((s) => s.resetPassword);
  const [info, setInfo] = useState<Info | null>(null);
  const { register, handleSubmit, formState, watch, setError } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  useEffect(() => {
    fetch(`/api/auth/reset?token=${encodeURIComponent(token)}`).then((r) => r.json()).then(setInfo).catch(() => setInfo({ valid: false }));
  }, [token]);

  if (!info) return <PageSkeleton />;
  if (!info.valid)
    return (
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-expense"><LinkIcon className="h-8 w-8" /></div>
        <h1 className="mt-5 text-2xl font-extrabold text-forest">Tautan tidak berlaku</h1>
        <p className="mt-2 text-[17px] text-muted">Tautan ini sudah dipakai, kedaluwarsa, atau tidak lengkap. Minta tautan baru kepada Admin Utama.</p>
        <Link href="/masuk" className={buttonClass("primary", "xl", "mt-7 w-full")}>Ke halaman masuk</Link>
      </div>
    );

  const activation = info.purpose === "activation";
  return (
    <div>
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-mint text-emerald-700"><KeyRound className="h-7 w-7" /></div>
      <h1 className="mt-5 text-3xl font-extrabold text-forest">{activation ? "Aktifkan Akun Anda" : "Buat Kata Sandi Baru"}</h1>
      <p className="mt-2 text-[17px] text-muted">
        {activation ? <>Om Swastyastu, <strong>{info.name}</strong>. Buat kata sandi untuk akun <strong>{info.email}</strong>.</> : <>Untuk akun <strong>{info.email}</strong>.</>}
      </p>
      <form
        className="mt-7 space-y-4"
        noValidate
        onSubmit={handleSubmit(async (v) => {
          const r = await reset(token, v.password);
          if (!r.ok) return setError("password", { message: r.error });
          toast.success(activation ? "Akun aktif! Selamat datang." : "Kata sandi diperbarui");
          router.push(useStore.getState().session?.activeTempleId ? "/app" : "/onboarding");
        })}
      >
        <Field label="Kata sandi baru" htmlFor="password" error={formState.errors.password?.message} hint="Minimal 8 karakter, berisi huruf dan angka">
          <PasswordInput id="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <StrengthBar password={watch("password") ?? ""} />
        <Field label="Ulangi kata sandi baru" htmlFor="confirm" error={formState.errors.confirm?.message}>
          <PasswordInput id="confirm" autoComplete="new-password" {...register("confirm")} />
        </Field>
        <Button type="submit" size="xl" className="w-full" loading={formState.isSubmitting}>{activation ? "Aktifkan & Masuk" : "Simpan Kata Sandi"}</Button>
      </form>
      <div className="mt-6"><SecureNote /></div>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
