"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { MockAuthNote, PasswordInput } from "@/components/shared/auth-bits";
import { useStore } from "@/lib/store";
import { ROLE_LABEL, ROLE_TONE } from "@/lib/permissions";
import { cn, initials } from "@/lib/format";
import type { Role } from "@/lib/types";

const schema = z.object({
  email: z.string().trim().email("Format email belum benar"),
  password: z.string().min(6, "Kata sandi minimal 6 karakter"),
});

const DEMO: { email: string; name: string; role: Role; color: string }[] = [
  { email: "made@pura.demo", name: "I Made Wirata", role: "ketua", color: "#087F6D" },
  { email: "ayu@pura.demo", name: "Ni Ketut Ayu Rahayu", role: "bendahara", color: "#C9A86A" },
  { email: "wayan@pura.demo", name: "I Wayan Sudiarta", role: "sekretaris", color: "#3F6FB5" },
  { email: "nyoman@pura.demo", name: "I Nyoman Gede Artha", role: "auditor", color: "#8A5CB8" },
  { email: "admin@pura.demo", name: "Tim Platform PURA", role: "platform", color: "#17212B" },
];

export default function LoginPage() {
  const router = useRouter();
  const login = useStore((s) => s.login);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState, setValue } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  async function doLogin(email: string) {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    const r = login(email);
    setLoading(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(`Selamat datang, ${r.value.callName}!`);
    const hasTemple = useStore.getState().session?.activeTempleId;
    router.push(hasTemple ? "/app" : "/onboarding");
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-forest">Masuk Pengurus</h1>
      <p className="mt-2 text-[17px] text-muted">Kelola kas dan dana punia pura Anda.</p>

      <form className="mt-7 space-y-4" onSubmit={handleSubmit((v) => doLogin(v.email))} noValidate>
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="nama@email.com" {...register("email")} aria-invalid={!!formState.errors.email} />
        </Field>
        <Field label="Kata sandi" htmlFor="password" error={formState.errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" {...register("password")} aria-invalid={!!formState.errors.password} />
        </Field>
        <div className="flex justify-end">
          <Link href="/lupa-sandi" className="text-sm font-semibold text-emerald-700 hover:underline">Lupa kata sandi?</Link>
        </div>
        <Button type="submit" size="xl" className="w-full" loading={loading}>Masuk</Button>
      </form>

      <div className="mt-8">
        <p className="text-sm font-bold uppercase tracking-wider text-muted">Akun demo — sekali ketuk</p>
        <ul className="mt-3 space-y-2">
          {DEMO.map((d) => (
            <li key={d.email}>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setValue("email", d.email);
                  doLogin(d.email);
                }}
                className="press flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left hover:border-emerald-300 hover:shadow-soft"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: d.color }}>
                  {initials(d.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{d.name}</span>
                  <span className={cn("mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold", ROLE_TONE[d.role])}>{ROLE_LABEL[d.role]}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-6"><MockAuthNote /></div>
      <p className="mt-6 text-center text-[15px] text-muted">
        Belum punya akun? <Link href="/daftar" className="font-semibold text-emerald-700 hover:underline">Daftarkan pura</Link>
      </p>
    </div>
  );
}
