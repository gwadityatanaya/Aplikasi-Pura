"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, Clock, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { WilayahPicker, emptyAddress, type AddressValue } from "@/components/app/wilayah-picker";
import { api } from "@/lib/store";

const empty = {
  banjarName: "", templeName: "", applicantName: "", applicantPosition: "", whatsapp: "", googleEmail: "",
  referrerName: "", referrerContact: "", reason: "", consent: false, website: "",
};

/** "Ajukan pendaftaran" — for a banjar that wants to use PURA. Public, no login, verified by hand. */
export default function RegisterPage() {
  const [f, setF] = useState(empty);
  const [addr, setAddr] = useState<AddressValue>(emptyAddress);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function submit() {
    if (!f.consent) return toast.error("Centang persetujuan penggunaan data terlebih dahulu.");
    setBusy(true);
    const { json } = await api("/api/pendaftaran", { body: { ...f, ...addr } });
    setBusy(false);
    if (!json.ok) return toast.error(json.error ?? "Pengajuan belum terkirim.");
    setSent(true);
    window.scrollTo({ top: 0 });
  }

  if (sent)
    return (
      <div className="container max-w-xl py-14 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-extrabold text-forest">Pengajuan terkirim</h1>
        <p className="mt-2 text-lg text-muted">Suksma. Admin Utama akan <b>memverifikasi secara manual</b> — termasuk menghubungi pemberi referensi — sehingga bisa memakan waktu beberapa hari sampai beberapa minggu. Kami akan menghubungi Anda lewat WhatsApp atau email yang Anda tulis.</p>
        <p className="mt-3 text-[0.9375rem] text-muted">Pengajuan ini <b>belum</b> memberi akses apa pun ke aplikasi.</p>
        <Link href="/" className={buttonClass("outline", "lg", "mt-6")}>Kembali ke beranda</Link>
      </div>
    );

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-3xl font-extrabold text-forest">Ajukan pendaftaran</h1>
      <p className="mt-1 text-[1.0625rem] text-muted">Untuk banjar yang ingin memakai PURA bagi kas dan punia puranya.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          { icon: ClipboardList, t: "Isi formulir", d: "Tanpa KTP atau nomor identitas." },
          { icon: Clock, t: "Diverifikasi manual", d: "Admin Utama menghubungi pemberi referensi. Bisa memakan waktu." },
          { icon: ShieldCheck, t: "Belum ada akses", d: "Akun pengurus dibuat setelah disetujui." },
        ].map((x) => (
          <Card key={x.t} className="p-4">
            <x.icon className="h-6 w-6 text-emerald-700" />
            <p className="mt-2 font-bold">{x.t}</p>
            <p className="text-sm text-muted">{x.d}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 space-y-5 p-5">
        <p className="font-bold">Banjar & pura</p>
        <Field label="Nama banjar" htmlFor="rg-banjar" required><Input id="rg-banjar" value={f.banjarName} onChange={(e) => set("banjarName", e.target.value)} placeholder="Banjar Adat …" /></Field>
        <fieldset className="space-y-3 rounded-2xl border border-line p-4">
          <legend className="px-1 text-[0.9375rem] font-bold">Wilayah banjar</legend>
          <WilayahPicker idPrefix="rg" value={addr} onChange={setAddr} />
        </fieldset>
        <Field label="Nama pura" htmlFor="rg-pura" required><Input id="rg-pura" value={f.templeName} onChange={(e) => set("templeName", e.target.value)} placeholder="Pura …" /></Field>
      </Card>

      <Card className="mt-4 space-y-5 p-5">
        <p className="font-bold">Pemohon</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama Anda" htmlFor="rg-name" required><Input id="rg-name" value={f.applicantName} onChange={(e) => set("applicantName", e.target.value)} /></Field>
          <Field label="Jabatan di banjar/pura" htmlFor="rg-pos" required><Input id="rg-pos" value={f.applicantPosition} onChange={(e) => set("applicantPosition", e.target.value)} placeholder="Kelian, Bendahara, …" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nomor WhatsApp" htmlFor="rg-wa" required><Input id="rg-wa" inputMode="tel" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="08…" /></Field>
          <Field label="Email Google" htmlFor="rg-email" required hint="Alamat yang nanti dipakai untuk masuk ke aplikasi."><Input id="rg-email" type="email" value={f.googleEmail} onChange={(e) => set("googleEmail", e.target.value)} /></Field>
        </div>
      </Card>

      <Card className="mt-4 space-y-5 p-5">
        <p className="font-bold">Referensi</p>
        <p className="-mt-3 text-sm text-muted">Orang yang mengenal banjar Anda dan bisa kami hubungi, mis. Bendesa, Kelian banjar lain, atau pengurus pura yang sudah memakai PURA.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama pemberi referensi" htmlFor="rg-ref" required><Input id="rg-ref" value={f.referrerName} onChange={(e) => set("referrerName", e.target.value)} /></Field>
          <Field label="Kontak pemberi referensi" htmlFor="rg-refc" required hint="Nomor WhatsApp atau email."><Input id="rg-refc" value={f.referrerContact} onChange={(e) => set("referrerContact", e.target.value)} /></Field>
        </div>
        <Field label="Alasan mendaftar" htmlFor="rg-reason" required><Textarea id="rg-reason" rows={3} maxLength={1000} value={f.reason} onChange={(e) => set("reason", e.target.value)} /></Field>
        {/* Honeypot for bots — invisible and skipped by keyboard and screen readers. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" value={f.website} onChange={(e) => set("website", e.target.value)} />
        <label className="flex items-start gap-2 text-[0.9375rem]">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
          <span>Saya setuju data di formulir ini disimpan dan dipakai <b>hanya oleh Admin Utama PURA</b> untuk memverifikasi pendaftaran, termasuk menghubungi saya dan pemberi referensi. Data tidak ditampilkan di halaman publik. Lihat <Link href="/kebijakan-privasi" className="font-semibold text-emerald-800 underline">kebijakan privasi</Link>.</span>
        </label>
      </Card>

      <Button size="xl" className="mt-5 w-full" loading={busy} disabled={!f.consent} onClick={submit}>Kirim pengajuan</Button>
      <p className="mt-2 text-center text-sm text-muted">Pendaftaran diverifikasi manual dan bisa memakan waktu. Mengirim beberapa kali tidak mempercepat proses.</p>
    </div>
  );
}
