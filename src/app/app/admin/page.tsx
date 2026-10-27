"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Crown, DatabaseBackup, Download, KeyRound, MapPin, Search, ShieldCheck, UserCheck, UserPlus, UserX, Users, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PageHeader, NoAccess } from "@/components/app/page-header";
import { Avatar } from "@/components/app/app-shell";
import { LinkDialog } from "@/components/app/link-dialog";
import { useCan } from "@/components/app/hooks";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, Input, Select } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import { MEMBER_ROLES, ROLE_LABEL, ROLE_TONE } from "@/lib/permissions";
import { cn, formatDateShort, relativeTime } from "@/lib/format";
import type { MemberRole, Membership, Temple, User } from "@/lib/types";

type AdminUser = User & { activated: boolean };
interface AdminData {
  users: AdminUser[];
  memberships: Membership[];
  temples: Temple[];
}

const addSchema = z.object({
  name: z.string().trim().min(3, "Isi nama lengkap"),
  email: z.string().trim().email("Email belum benar"),
  templeId: z.string().optional(),
  role: z.enum(MEMBER_ROLES).optional(),
});

export default function AdminPanelPage() {
  const can = useCan();
  const isDemo = useStore((s) => s.mode === "demo");
  const me = useStore((s) => s.session?.userId);
  const refreshState = useStore((s) => s.refresh);
  const createUser = useStore((s) => s.adminCreateUser);
  const setUserStatus = useStore((s) => s.adminSetUserStatus);
  const setMembership = useStore((s) => s.adminSetMembership);
  const resetLink = useStore((s) => s.adminResetLink);
  const setTempleStatus = useStore((s) => s.setTempleStatus);
  const [tab, setTab] = useState<"pengguna" | "pura" | "cadangan">("pengguna");
  const [data, setData] = useState<AdminData | null>(null);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [link, setLink] = useState<{ link: string; name: string; hours?: number; purpose: "activation" | "reset" } | null>(null);
  const [rolesFor, setRolesFor] = useState<AdminUser | null>(null);
  const [statusFor, setStatusFor] = useState<AdminUser | null>(null);
  const [templeAction, setTempleAction] = useState<{ t: Temple; status: Temple["status"] } | null>(null);
  const form = useForm<z.infer<typeof addSchema>>({ resolver: zodResolver(addSchema) });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const j = await res.json();
    if (j.ok) setData(j);
    else toast.error(j.error);
  }, []);
  useEffect(() => {
    if (!isDemo && can("admin.manage")) load();
  }, [load, isDemo, can]);

  const users = useMemo(() => (data?.users ?? []).filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const requests = (data?.users ?? []).filter((u) => u.resetRequestedAt);
  const pendingTemples = (data?.temples ?? []).filter((t) => t.status === "pending");

  if (isDemo) return <Card><EmptyState icon={ShieldCheck} title="Tidak tersedia di mode demo" description="Panel Admin Utama hanya untuk data sungguhan." /></Card>;
  if (!can("admin.manage")) return <NoAccess what="Panel Admin Utama" />;

  async function after<T>(r: { ok: true; value: T } | { ok: false; error: string }, msg?: string) {
    if (!r.ok) {
      toast.error(r.error);
      return null;
    }
    if (msg) toast.success(msg);
    await load();
    await refreshState();
    return r.value;
  }

  return (
    <div>
      <PageHeader title="Panel Admin Utama" description="Kelola semua pengguna, pura, dan cadangan data. Tindakan di sini tercatat di Log Aktivitas." actions={<Link href="/app/log-aktivitas" className={buttonClass("outline")}>Buka Log Aktivitas</Link>} />

      {(requests.length > 0 || pendingTemples.length > 0) && (
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          {requests.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 p-4">
              <p className="font-bold text-amber-900">{requests.length} permintaan atur ulang kata sandi</p>
              <ul className="mt-2 space-y-2">
                {requests.map((u) => (
                  <li key={u.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">{u.name} · {relativeTime(u.resetRequestedAt!)}</span>
                    <Button size="sm" onClick={async () => { const v = await after(await resetLink(u.id)); if (v?.link) setLink({ link: v.link, name: u.name, hours: v.hours, purpose: "reset" }); }}>Buat tautan</Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {pendingTemples.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 p-4">
              <p className="font-bold text-amber-900">{pendingTemples.length} pura menunggu persetujuan</p>
              <button className="mt-2 text-sm font-semibold text-emerald-700 hover:underline" onClick={() => setTab("pura")}>Tinjau sekarang →</button>
            </Card>
          )}
        </div>
      )}

      <Segmented value={tab} onChange={setTab} ariaLabel="Bagian panel" options={[{ value: "pengguna", label: "Pengguna" }, { value: "pura", label: "Pura" }, { value: "cadangan", label: "Cadangan data" }]} />

      {tab === "pengguna" && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              <input aria-label="Cari pengguna" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau email…" className="h-12 w-full rounded-xl border border-line bg-white pl-12 pr-4 text-[16px] focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15" />
            </div>
            <Button size="lg" onClick={() => { form.reset({ name: "", email: "", templeId: "", role: undefined }); setAdding(true); }}><UserPlus className="h-5 w-5" /> Tambah pengguna</Button>
          </div>
          <Card>
            {!data && <div className="space-y-3 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>}
            <ul className="divide-y divide-line">
              {users.map((u) => {
                const mems = data!.memberships.filter((m) => m.userId === u.id);
                return (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                    <Avatar name={u.name} color={u.avatarColor} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-bold">
                        {u.name} {u.id === me && <span className="text-sm font-medium text-muted">(Anda)</span>}
                        {u.isSuperAdmin && <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", ROLE_TONE.superadmin)}><Crown className="h-3 w-3" /> Admin Utama</span>}
                        {u.status === "disabled" && <Badge tone="red">Nonaktif</Badge>}
                        {!u.activated && <Badge tone="amber">Belum aktivasi</Badge>}
                      </p>
                      <p className="text-sm text-muted">{u.email} · {u.lastLoginAt ? `terakhir masuk ${relativeTime(u.lastLoginAt)}` : "belum pernah masuk"}</p>
                      {mems.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {mems.map((m) => <span key={m.id} className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ROLE_TONE[m.role])}>{ROLE_LABEL[m.role]} · {data!.temples.find((t) => t.id === m.templeId)?.name}</span>)}
                        </div>
                      )}
                    </div>
                    {u.isSuperAdmin ? (
                      <span className="flex items-center gap-1.5 text-sm text-muted"><ShieldCheck className="h-4 w-4" /> Dilindungi</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setRolesFor(u)}><Users className="h-4 w-4" /> Atur peran</Button>
                        <Button size="sm" variant="outline" onClick={async () => { const v = await after(await resetLink(u.id)); if (v?.link) setLink({ link: v.link, name: u.name, hours: v.hours, purpose: u.activated ? "reset" : "activation" }); }}><KeyRound className="h-4 w-4" /> {u.activated ? "Atur ulang sandi" : "Tautan aktivasi"}</Button>
                        <Button size="sm" variant={u.status === "disabled" ? "secondary" : "ghost"} className={u.status === "disabled" ? "" : "text-expense"} onClick={() => setStatusFor(u)}>
                          {u.status === "disabled" ? <><UserCheck className="h-4 w-4" /> Aktifkan</> : <><UserX className="h-4 w-4" /> Nonaktifkan</>}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {data && !users.length && <EmptyState icon={Users} title="Tidak ada pengguna yang cocok" />}
          </Card>
          <p className="mt-3 text-sm text-muted">Pengguna tidak pernah dihapus permanen agar riwayat siapa mencatat apa tetap utuh. Gunakan &ldquo;Nonaktifkan&rdquo; untuk mencabut akses seketika.</p>
        </div>
      )}

      {tab === "pura" && (
        <Card className="mt-4">
          <ul className="divide-y divide-line">
            {(data?.temples ?? []).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 p-4">
                <Building2 className="h-6 w-6 text-emerald-700" />
                <div className="min-w-0 flex-1">
                  <Link href={`/pura/${t.slug}`} target="_blank" className="font-bold hover:text-emerald-700">{t.name}</Link>
                  <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="h-3.5 w-3.5" /> {t.regency}, {t.province} · daftar {formatDateShort(t.createdAt)}</p>
                </div>
                <Badge tone={t.status === "active" ? "green" : t.status === "pending" ? "amber" : "red"} dot>{t.status === "active" ? "Aktif" : t.status === "pending" ? "Menunggu" : "Ditolak"}</Badge>
                {t.status !== "active" && <Button size="sm" onClick={() => setTempleAction({ t, status: "active" })}><CheckCircle2 className="h-4 w-4" /> Setujui</Button>}
                {t.status === "pending" && <Button size="sm" variant="outline" className="text-expense" onClick={() => setTempleAction({ t, status: "rejected" })}><XCircle className="h-4 w-4" /> Tolak</Button>}
                {t.status === "active" && <Button size="sm" variant="ghost" onClick={() => setTempleAction({ t, status: "pending" })}>Tangguhkan</Button>}
              </li>
            ))}
          </ul>
          {data && !data.temples.length && <EmptyState icon={Building2} title="Belum ada pura" description="Buat pura pertama melalui menu pilih pura → Daftarkan pura lain." />}
        </Card>
      )}

      {tab === "cadangan" && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader title="Unduh cadangan sekarang" description="Semua data dalam satu file (tanpa foto nota)." />
            <CardBody className="space-y-3">
              <a href="/api/admin/backup" className={buttonClass("primary", "lg", "w-full")} onClick={() => toast("Menyiapkan file cadangan…")}><Download className="h-5 w-5" /> Unduh cadangan (.json)</a>
              <p className="text-sm text-muted">Simpan file ini di tempat aman (mis. Google Drive pribadi). File berisi data keuangan — jangan dibagikan.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Cadangan lengkap & pemulihan" />
            <CardBody className="space-y-2 text-[15px] text-charcoal/80">
              <p className="flex gap-2"><DatabaseBackup className="h-5 w-5 shrink-0 text-emerald-700" /> Database Neon menyimpan riwayat otomatis sehingga data bisa dikembalikan ke waktu tertentu.</p>
              <p>Untuk cadangan lengkap beserta foto, jalankan <code className="rounded bg-stone-100 px-1.5">npm run backup</code> di komputer. Langkah lengkap ada di <strong>docs/PANDUAN.md</strong>.</p>
            </CardBody>
          </Card>
        </div>
      )}

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Tambah pengguna"
        description="Pengguna akan menerima tautan aktivasi untuk membuat kata sandinya sendiri."
        footer={
          <Button
            size="lg"
            className="w-full"
            loading={form.formState.isSubmitting}
            onClick={form.handleSubmit(async (v) => {
              const r = await createUser({ name: v.name, email: v.email, templeId: v.templeId || undefined, role: v.templeId ? (v.role ?? "bendahara") : undefined });
              const val = await after(r);
              if (!val) return;
              setAdding(false);
              if (val.link) setLink({ link: val.link, name: v.name, hours: val.hours, purpose: "activation" });
              else toast.success("Pengguna sudah ada — peran ditambahkan.");
            })}
          >
            Buat akun & tautan aktivasi
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Nama lengkap" htmlFor="a-name" error={form.formState.errors.name?.message}><Input id="a-name" {...form.register("name")} /></Field>
          <Field label="Email" htmlFor="a-email" error={form.formState.errors.email?.message}><Input id="a-email" type="email" {...form.register("email")} /></Field>
          <Field label="Pura (opsional)" htmlFor="a-temple">
            <Select id="a-temple" {...form.register("templeId")}>
              <option value="">— Atur nanti —</option>
              {(data?.temples ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Peran di pura tersebut" htmlFor="a-role">
            <Select id="a-role" {...form.register("role")}>{MEMBER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>
          </Field>
        </div>
      </Dialog>

      <Dialog open={!!rolesFor} onClose={() => setRolesFor(null)} title={`Peran ${rolesFor?.name ?? ""}`} description="Atur peran pengguna di setiap pura. Perubahan langsung berlaku.">
        {rolesFor && data && (
          <ul className="divide-y divide-line pb-2">
            {data.temples.map((t) => {
              const m = data.memberships.find((x) => x.userId === rolesFor.id && x.templeId === t.id);
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-1 font-semibold">{t.name}</span>
                  <Select
                    aria-label={`Peran di ${t.name}`}
                    className="h-10 w-48 text-sm"
                    value={m?.role ?? ""}
                    onChange={async (e) => {
                      const role = (e.target.value || null) as MemberRole | null;
                      await after(await setMembership(rolesFor.id, t.id, role), role ? `Peran diatur: ${ROLE_LABEL[role]}` : "Akses dicabut");
                    }}
                  >
                    <option value="">Tanpa akses</option>
                    {MEMBER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </Select>
                </li>
              );
            })}
          </ul>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!statusFor}
        onClose={() => setStatusFor(null)}
        tone={statusFor?.status === "disabled" ? "primary" : "danger"}
        title={statusFor?.status === "disabled" ? `Aktifkan kembali ${statusFor?.name}?` : `Nonaktifkan ${statusFor?.name}?`}
        description={statusFor?.status === "disabled" ? "Pengguna dapat masuk kembali dengan kata sandinya." : "Pengguna langsung dikeluarkan dari semua perangkat dan tidak dapat masuk. Catatan yang pernah dibuatnya tetap tersimpan."}
        confirmLabel={statusFor?.status === "disabled" ? "Aktifkan" : "Nonaktifkan"}
        onConfirm={async () => {
          if (!statusFor) return;
          const next = statusFor.status === "disabled" ? "active" : "disabled";
          setStatusFor(null);
          await after(await setUserStatus(statusFor.id, next), next === "disabled" ? "Pengguna dinonaktifkan" : "Pengguna diaktifkan");
        }}
      />
      <ConfirmDialog
        open={!!templeAction}
        onClose={() => setTempleAction(null)}
        tone={templeAction?.status === "active" ? "primary" : "danger"}
        title={templeAction?.status === "active" ? "Setujui pura ini?" : templeAction?.status === "rejected" ? "Tolak pendaftaran?" : "Tangguhkan pura?"}
        description={templeAction?.status === "active" ? "Pura akan tampil di direktori publik." : "Pura tidak tampil di halaman publik. Data keuangannya tetap tersimpan."}
        onConfirm={async () => {
          if (!templeAction) return;
          const { t, status } = templeAction;
          setTempleAction(null);
          await after(await setTempleStatus(t.id, status), "Status pura diperbarui");
        }}
      />
      <LinkDialog link={link?.link ?? null} name={link?.name} hours={link?.hours} purpose={link?.purpose ?? "activation"} onClose={() => setLink(null)} />
    </div>
  );
}
