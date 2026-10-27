"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronRight, FlaskConical, KeyRound } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { PasswordInput, SecureNote } from "@/components/shared/auth-bits";
import { useStore } from "@/lib/store";
import { ROLE_LABEL, ROLE_TONE } from "@/lib/permissions";
import { cn, initials } from "@/lib/format";
import type { Role } from "@/lib/types";

const schema = z.object({
  email: z.string().trim().email("Format email belum benar"),
  password: z.string().min(1, "Isi kata sandi"),
});

const DEMO: { id: string; name: string; role: Role; color: string }[] = [
  { id: "u_made", name: "I Made Wirata", role: "ketua", color: "#087F6D" },
  { id: "u_ayu", name: "Ni Ketut Ayu Rahayu", role: "bendahara", color: "#C9A86A" },
  { id: "u_wayan", name: "I Wayan Sudiarta", role: "sekretaris", color: "#3F6FB5" },
  { id: "u_nyoman", name: "I Nyoman Gede Artha", role: "auditor", color: "#8A5CB8" },
  { id: "u_platform", name: "Admin Utama (Demo)", role: "superadmin", color: "#17212B" },
];

export default function LoginPage() {
  const router = useRouter();
  const login = useStore((s) => s.login);
  const enterDemo = useStore((s) => s.enterDemo);
  const [demoOpen, setDemoOpen] = useState(false);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const { register, handleSubmit, formState, setError } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  useEffect(() => {
    fetch("/api/setup").then((r) => r.json()).then((j) => setSetupNeeded(j.ok && !j.done)).catch(() => {});
  }, []);

  const onSubmit = handleSubmit(async (v) => {
    const r = await login(v.email, v.password);
    if (!r.ok) {
      setError("password", { message: r.error });
      return;
    }
    const s = useStore.getState();
    const me = s.data.users.find((u) => u.id === s.session?.userId);
    toast.success(`Selamat datang, ${me?.callName ?? ""}!`);
    router.push(s.session?.activeTempleId ? "/app" : "/onboarding");
  });

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-forest">Masuk Pengurus</h1>
      <p className="mt-2 text-[17px] text-muted">Kelola kas dan dana punia pura Anda.</p>

      {setupNeeded && (
        <Link href="/setup" className="mt-5 flex items-center gap-3 rounded-2xl border border-gold/50 bg-gold-light/60 p-4 text-gold-dark hover:bg-gold-light">
          <KeyRound className="h-5 w-5 shrink-0" />
          <span className="flex-1 text-sm"><strong>Aplikasi belum disiapkan.</strong> Buat akun Admin Utama terlebih dahulu.</span>
          <ChevronRight className="h-5 w-5" />
        </Link>
      )}

      <form className="mt-7 space-y-4" onSubmit={onSubmit} noValidate>
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" placeholder="nama@email.com" {...register("email")} aria-invalid={!!formState.errors.email} />
        </Field>
        <Field label="Kata sandi" htmlFor="password" error={formState.errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" {...register("password")} aria-invalid={!!formState.errors.password} />
        </Field>
        <div className="flex justify-end">
          <Link href="/lupa-sandi" className="text-sm font-semibold text-emerald-700 hover:underline">Lupa kata sandi?</Link>
        </div>
        <Button type="submit" size="xl" className="w-full" loading={formState.isSubmitting}>Masuk</Button>
      </form>
      <div className="mt-6"><SecureNote /></div>

      <div className="mt-8 rounded-2xl border border-dashed border-line p-4">
        <p className="flex items-center gap-2 font-semibold"><FlaskConical className="h-4 w-4 text-gold-dark" /> Ingin mencoba dulu?</p>
        <p className="mt-1 text-sm text-muted">Mode demo memakai data contoh di perangkat ini saja dan tidak menyentuh data pura sungguhan.</p>
        <Button variant="outline" className="mt-3 w-full" onClick={() => setDemoOpen(true)}>Coba mode demo</Button>
      </div>
      <p className="mt-6 text-center text-[15px] text-muted">
        Belum punya akun? <Link href="/daftar" className="font-semibold text-emerald-700 hover:underline">Daftar</Link>
      </p>

      <Dialog open={demoOpen} onClose={() => setDemoOpen(false)} title="Masuk ke mode demo sebagai…" description="Pilih peran untuk melihat apa yang bisa dilakukan tiap pengurus.">
        <ul className="space-y-2 pb-2">
          {DEMO.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => {
                  enterDemo(d.id);
                  setDemoOpen(false);
                  toast("Mode demo aktif", { description: "Data contoh — tidak tersimpan ke server." });
                  router.push("/app");
                }}
                className="press flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left hover:border-emerald-300 hover:shadow-soft"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: d.color }}>{initials(d.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{d.name}</span>
                  <span className={cn("mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold", ROLE_TONE[d.role])}>{ROLE_LABEL[d.role]}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-muted" />
              </button>
            </li>
          ))}
        </ul>
        <Link href="/" className={buttonClass("ghost", "md", "mt-1 w-full")}>Batal</Link>
      </Dialog>
    </div>
  );
}
