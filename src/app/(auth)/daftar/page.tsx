"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { MockAuthNote, PasswordInput } from "@/components/shared/auth-bits";
import { useStore } from "@/lib/store";

const schema = z
  .object({
    name: z.string().trim().min(3, "Tulis nama lengkap Anda"),
    email: z.string().trim().email("Format email belum benar"),
    password: z.string().min(8, "Minimal 8 karakter").regex(/\d/, "Sertakan minimal satu angka"),
    confirm: z.string(),
    agree: z.literal(true, { errorMap: () => ({ message: "Centang untuk melanjutkan" }) }),
  })
  .refine((v) => v.password === v.confirm, { message: "Kata sandi tidak sama", path: ["confirm"] });

export default function RegisterPage() {
  const router = useRouter();
  const registerUser = useStore((s) => s.register);
  const { register, handleSubmit, formState, watch } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const pw = watch("password") ?? "";
  const strength = (pw.length >= 8 ? 1 : 0) + (/\d/.test(pw) ? 1 : 0) + (/[A-Z]/.test(pw) ? 1 : 0) + (/[^\w]/.test(pw) ? 1 : 0);

  const onSubmit = handleSubmit(async (v) => {
    await new Promise((r) => setTimeout(r, 500));
    // The password is validated but never stored — mock auth only.
    const r = registerUser({ name: v.name, email: v.email });
    if (!r.ok) return toast.error(r.error);
    toast.success("Akun berhasil dibuat", { description: "Sekarang lengkapi data pura Anda." });
    router.push("/onboarding");
  });

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-forest">Buat Akun Pengurus</h1>
      <p className="mt-2 text-[17px] text-muted">Langkah 1 dari 2 — setelah ini Anda akan mendaftarkan pura.</p>
      <form className="mt-7 space-y-4" onSubmit={onSubmit} noValidate>
        <Field label="Nama lengkap" htmlFor="name" error={formState.errors.name?.message}>
          <Input id="name" autoComplete="name" placeholder="I Made …" {...register("name")} aria-invalid={!!formState.errors.name} />
        </Field>
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} aria-invalid={!!formState.errors.email} />
        </Field>
        <Field label="Kata sandi" htmlFor="password" error={formState.errors.password?.message} hint="Minimal 8 karakter dan mengandung angka">
          <PasswordInput id="password" autoComplete="new-password" {...register("password")} aria-invalid={!!formState.errors.password} />
        </Field>
        <div className="flex gap-1.5" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < strength ? (strength < 2 ? "bg-expense" : strength < 3 ? "bg-gold" : "bg-emerald-600") : "bg-stone-200"}`} />
          ))}
        </div>
        <Field label="Ulangi kata sandi" htmlFor="confirm" error={formState.errors.confirm?.message}>
          <PasswordInput id="confirm" autoComplete="new-password" {...register("confirm")} aria-invalid={!!formState.errors.confirm} />
        </Field>
        <label className="flex items-start gap-3 text-[15px]">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-600" {...register("agree")} />
          <span>Saya memahami ini adalah prototipe dan hanya memakai data contoh.</span>
        </label>
        {formState.errors.agree && <p className="text-sm font-medium text-expense">{formState.errors.agree.message}</p>}
        <Button type="submit" size="xl" className="w-full" loading={formState.isSubmitting}>Buat Akun</Button>
      </form>
      <div className="mt-6"><MockAuthNote /></div>
      <p className="mt-6 text-center text-[15px] text-muted">
        Sudah punya akun? <Link href="/masuk" className="font-semibold text-emerald-700 hover:underline">Masuk</Link>
      </p>
    </div>
  );
}
