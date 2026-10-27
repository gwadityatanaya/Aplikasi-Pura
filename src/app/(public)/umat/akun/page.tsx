"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireLogin } from "@/components/umat/use-umat";
import { LogoutEverywhere } from "@/components/shared/logout-everywhere";
import { AvatarEditor } from "@/components/shared/avatar-editor";
import { useStore } from "@/lib/store";

export default function MyAccountPage() {
  const { ready, me } = useRequireLogin();
  const isStaff = useStore((s) => s.access.isStaff);
  const updateUser = useStore((s) => s.updateUser);
  const run = useStore((s) => s.run);
  const logout = useStore((s) => s.logout);
  const router = useRouter();
  const [name, setName] = useState("");
  const [callName, setCallName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (me) {
      setName(me.name);
      setCallName(me.callName ?? "");
      setPhone(me.phone ?? "");
    }
  }, [me]);

  if (!ready || !me) return <div className="container max-w-xl py-10"><Skeleton className="h-64 rounded-3xl" /></div>;

  async function save() {
    setSaving(true);
    const r = await updateUser({ name: name.trim(), callName: callName.trim() || name.trim().split(" ")[0], phone: phone.trim() || undefined });
    setSaving(false);
    if (r.ok) toast.success("Profil disimpan.");
    else toast.error(r.error);
  }

  async function remove() {
    setDeleting(true);
    const r = await run("deleteMyAccount", { confirm: confirmText.trim().toUpperCase() });
    setDeleting(false);
    if (!r.ok) return toast.error(r.error);
    await logout();
    toast.success("Akun Anda sudah dihapus.");
    router.replace("/");
  }

  return (
    <div className="container max-w-xl py-8">
      <Link href="/umat" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
      <h1 className="mt-2 text-3xl font-extrabold text-forest">Akun saya</h1>

      <Card className="mt-6 space-y-4 p-5">
        <AvatarEditor user={me} />
        <Field label="Email (untuk masuk)"><Input value={me.email} disabled /></Field>
        <Field label="Nama lengkap" htmlFor="ak-name" hint="Nama ini dipakai jika Anda memilih TAMPIL saat berpunia."><Input id="ak-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Nama panggilan" htmlFor="ak-call"><Input id="ak-call" value={callName} onChange={(e) => setCallName(e.target.value)} /></Field>
        <Field label="No. HP (opsional)" htmlFor="ak-phone"><Input id="ak-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Button size="lg" className="w-full" loading={saving} onClick={save}>Simpan</Button>
      </Card>

      <Card className="mt-4 p-5">
        <p className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-emerald-700" /> Privasi</p>
        <p className="mt-1 text-[15px] text-muted">Baca bagaimana data Anda disimpan dan siapa yang dapat melihatnya.</p>
        <Link href="/kebijakan-privasi" className="mt-2 inline-block font-semibold text-emerald-800 underline">Kebijakan privasi</Link>
      </Card>

      <div className="mt-4"><LogoutEverywhere /></div>

      <Button variant="outline" size="lg" className="mt-4 w-full" onClick={async () => { await logout(); router.replace("/"); }}>
        <LogOut className="h-5 w-5" /> Keluar
      </Button>

      <Card className="mt-8 border-red-200 p-5">
        <p className="font-bold text-red-800">Hapus akun</p>
        {isStaff ? (
          <p className="mt-1 text-[15px] text-muted">Akun Anda terdaftar sebagai pengurus. Minta Admin Utama mencabut peran pengurus terlebih dahulu sebelum menghapus akun.</p>
        ) : (
          <>
            <p className="mt-1 text-[15px] text-muted">
              Akun dan data pribadi Anda dihapus. Punia yang sudah disahkan tetap tersimpan sebagai arsip keuangan pura, tetapi nama Anda diganti menjadi &quot;Anonim&quot;.
            </p>
            <Button variant="danger" className="mt-3" onClick={() => setAskDelete(true)}><Trash2 className="h-4 w-4" /> Hapus akun saya</Button>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={askDelete}
        onClose={() => setAskDelete(false)}
        onConfirm={remove}
        tone="danger"
        loading={deleting}
        title="Hapus akun?"
        confirmLabel="Hapus selamanya"
        description="Tindakan ini tidak dapat dibatalkan. Ketik HAPUS untuk melanjutkan."
      >
        <Input aria-label="Ketik HAPUS" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="HAPUS" autoCapitalize="characters" />
      </ConfirmDialog>
    </div>
  );
}
