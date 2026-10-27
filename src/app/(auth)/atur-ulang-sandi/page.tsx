"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/shared/auth-bits";
import { useStore } from "@/lib/store";

const schema = z
  .object({ password: z.string().min(8, "Minimal 8 karakter").regex(/\d/, "Sertakan minimal satu angka"), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Kata sandi tidak sama", path: ["confirm"] });

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const reset = useStore((s) => s.resetPassword);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <div>
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-mint text-emerald-700"><KeyRound className="h-7 w-7" /></div>
      <h1 className="mt-5 text-3xl font-extrabold text-forest">Buat Kata Sandi Baru</h1>
      <p className="mt-2 text-[17px] text-muted">Gunakan kata sandi yang mudah Anda ingat namun sulit ditebak orang lain.</p>
      <form
        className="mt-7 space-y-4"
        noValidate
        onSubmit={handleSubmit(async () => {
          await new Promise((r) => setTimeout(r, 400));
          const r = reset(token);
          if (!r.ok) return setError(r.error);
          toast.success("Kata sandi diperbarui", { description: "Silakan masuk kembali." });
          router.push("/masuk");
        })}
      >
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">{error} <Link href="/lupa-sandi" className="underline">Minta tautan baru</Link></p>}
        <Field label="Kata sandi baru" htmlFor="password" error={formState.errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <Field label="Ulangi kata sandi baru" htmlFor="confirm" error={formState.errors.confirm?.message}>
          <PasswordInput id="confirm" autoComplete="new-password" {...register("confirm")} />
        </Field>
        <Button type="submit" size="xl" className="w-full" loading={formState.isSubmitting}>Simpan Kata Sandi</Button>
        <p className="text-sm text-muted">Prototipe: kata sandi tidak disimpan di mana pun.</p>
      </form>
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
