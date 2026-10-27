"use client";
import { WilayahPicker, emptyAddress, type AddressValue } from "@/components/app/wilayah-picker";
import { useRouter } from "next/navigation";
import { templeLocation } from "@/lib/temple";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, Crown, DatabaseBackup, Download, Eye, Landmark, Mail, MapPin, Pencil, Plus, Search, ShieldCheck, UserCheck, UserPlus, UserX, Users, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, NoAccess } from "@/components/app/page-header";
import { Avatar } from "@/components/app/app-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { api, useAccess, useStore, type Result } from "@/lib/store";
import { BANJAR_POSITIONS, POSITION_LABEL, ROLE_LABEL, ROLE_TONE, TEMPLE_POSITIONS } from "@/lib/permissions";
import { cn, relativeTime } from "@/lib/format";
import type { Banjar, BanjarMember, Membership, Position, Temple, User } from "@/lib/types";

type AdminTemple = Temple & { banjarIds: string[]; pengurusCount: number; pendingCount: number };
interface AdminData {
  users: User[];
  memberships: Membership[];
  temples: AdminTemple[];
  banjars: Banjar[];
  banjarMembers: BanjarMember[];
}

const pickAddress = (x: AddressValue): AddressValue => ({
  province: x.province, regency: x.regency, district: x.district, village: x.village,
  provinceCode: x.provinceCode ?? null, regencyCode: x.regencyCode ?? null, districtCode: x.districtCode ?? null, villageCode: x.villageCode ?? null,
});
const emptyTemple = { id: "", name: "", ...emptyAddress, address: "", description: "", phone: "", status: "active" as "active" | "pending", banjarIds: [] as string[] };
const emptyBanjar = { id: "", name: "", ...emptyAddress, address: "", status: "active" as "active" | "inactive" };

export default function BackOfficePage() {
  // Back Office belongs to the Admin Utama ACCOUNT, not to a temple role: it must work even before
  // any temple exists (right after /setup), exactly like the server check (requireSuperAdmin).
  const isAdmin = useAccess().isSuperAdmin;
  const me = useStore((s) => s.session?.userId);
  const run = useStore((s) => s.run);
  const refreshState = useStore((s) => s.refresh);
  const [tab, setTab] = useState<"pura" | "banjar" | "akun" | "cadangan">("pura");
  const [data, setData] = useState<AdminData | null>(null);
  const [q, setQ] = useState("");
  const [templeForm, setTempleForm] = useState<typeof emptyTemple | null>(null);
  const [banjarForm, setBanjarForm] = useState<typeof emptyBanjar | null>(null);
  const [bankFor, setBankFor] = useState<{ t: AdminTemple; bankName: string; bankAccountNumber: string; bankAccountHolder: string } | null>(null);
  const [bankConfirm, setBankConfirm] = useState(false);
  const [staffFor, setStaffFor] = useState<{ kind: "temple"; t: AdminTemple } | { kind: "banjar"; b: Banjar } | null>(null);
  const [newStaff, setNewStaff] = useState({ email: "", name: "", role: "pengurus" as "pengurus" | "pemeriksa" });
  const [removeStaff, setRemoveStaff] = useState<{ kind: "temple" | "banjar"; id: string; label: string } | null>(null);
  const [statusFor, setStatusFor] = useState<User | null>(null);
  const router = useRouter();
  const setActive = useStore((s) => s.setActiveTemple);
  const [emailFor, setEmailFor] = useState<User | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { json } = await api<AdminData>("/api/admin/users");
    if (json.ok) setData(json);
    else toast.error(json.error ?? "Gagal memuat Back Office.");
  }, []);
  useEffect(() => {
    if (isAdmin) load();
  }, [load, isAdmin]);

  const banjarName = useCallback((id: string) => data?.banjars.find((b) => b.id === id)?.name ?? "—", [data]);
  const userById = useCallback((id: string) => data?.users.find((u) => u.id === id), [data]);
  const warnings = useMemo(() => {
    const t = data?.temples ?? [];
    return { noPengurus: t.filter((x) => x.pengurusCount === 0), single: t.filter((x) => x.pengurusCount === 1), noBank: t.filter((x) => !x.bankAccountNumber) };
  }, [data]);
  const users = useMemo(() => (data?.users ?? []).filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())), [data, q]);

  if (!isAdmin) return <NoAccess what="Back Office" />;

  async function done<T>(p: Promise<Result<T>>, msg: string) {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    toast.success(msg);
    await Promise.all([load(), refreshState()]);
    return true;
  }

  const rolesOf = (u: User) => [
    ...(data?.memberships ?? []).filter((m) => m.userId === u.id && m.status === "active").map((m) => ({ key: m.id, role: m.role, where: data!.temples.find((t) => t.id === m.templeId)?.name ?? "" })),
    ...(data?.banjarMembers ?? []).filter((m) => m.userId === u.id && m.status === "active").map((m) => ({ key: m.id, role: "banjar" as const, where: banjarName(m.banjarId) })),
  ];

  return (
    <div>
      <PageHeader title="Back Office" description="Kelola banjar, pura, rekening, dan pengurus. Setiap perubahan tercatat di Log Aktivitas." actions={<Link href="/app/log-aktivitas" className={buttonClass("outline")}>Buka Log Aktivitas</Link>} />

      {data && (warnings.noPengurus.length > 0 || warnings.single.length > 0 || warnings.noBank.length > 0) && (
        <Card className="mb-5 border-amber-200 bg-amber-50/50 p-4">
          <p className="flex items-center gap-2 font-bold text-amber-900"><AlertTriangle className="h-5 w-5" /> Perlu perhatian</p>
          <ul className="mt-2 space-y-1.5 text-[15px] text-amber-900">
            {warnings.noPengurus.length > 0 && <li>• <strong>{warnings.noPengurus.length} pura</strong> belum punya Pengurus Pura — punianya diverifikasi oleh Pengurus Banjar: {warnings.noPengurus.map((t) => t.name).join(", ")}.</li>}
            {warnings.single.length > 0 && <li>• <strong>{warnings.single.length} pura</strong> hanya punya satu pengurus. Punia yang dikirim pengurus itu sendiri harus disetujui Pengurus Banjar: {warnings.single.map((t) => t.name).join(", ")}.</li>}
            {warnings.noBank.length > 0 && <li>• <strong>{warnings.noBank.length} pura</strong> belum diisi info rekening, jadi umat belum bisa berpunia lewat aplikasi: {warnings.noBank.map((t) => t.name).join(", ")}.</li>}
          </ul>
        </Card>
      )}

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <Segmented value={tab} onChange={setTab} ariaLabel="Bagian Back Office" options={[{ value: "pura", label: "Pura" }, { value: "banjar", label: "Banjar" }, { value: "akun", label: "Akun" }, { value: "cadangan", label: "Cadangan data" }]} />
      </div>
      {!data && <div className="mt-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>}

      {data && tab === "pura" && (
        <div className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button size="lg" onClick={() => (data.banjars.length ? setTempleForm({ ...emptyTemple, banjarIds: [data.banjars[0].id] }) : (toast("Buat banjar terlebih dahulu"), setTab("banjar")))}><Plus className="h-5 w-5" /> Tambah pura</Button>
          </div>
          <Card>
            <ul className="divide-y divide-line">
              {data.temples.map((t) => (
                <li key={t.id} className="p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <Building2 className="mt-1 h-6 w-6 text-emerald-700" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/pura/${t.slug}`} target="_blank" className="text-[17px] font-bold hover:text-emerald-700">{t.name}</Link>
                      <p className="text-sm text-muted">Banjar Pengempon: {t.banjarIds.map(banjarName).join(", ") || "—"}</p>
                      {templeLocation(t) && <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="h-3.5 w-3.5" /> {templeLocation(t)}</p>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {t.status !== "active" && <Badge tone="gray">Nonaktif</Badge>}
                        {t.pengurusCount === 0 ? <Badge tone="amber">Pengurus pura belum terdaftar</Badge> : t.pengurusCount === 1 ? <Badge tone="amber">Hanya 1 pengurus</Badge> : <Badge tone="green">{t.pengurusCount} pengurus</Badge>}
                        {t.bankAccountNumber ? <Badge tone="emerald"><Landmark className="h-3 w-3" /> {t.bankName} · a.n. {t.bankAccountHolder}</Badge> : <Badge tone="red">Rekening belum diisi</Badge>}
                        {t.pendingCount > 0 && <Badge tone="gold">{t.pendingCount} punia menunggu</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 pl-9">
                    <Button size="sm" onClick={async () => { const r = await setActive(t.id); if (!r.ok) return toast.error(r.error); router.push("/app"); }}><Eye className="h-4 w-4" /> Buka dashboard</Button>
                    <Button size="sm" variant="outline" onClick={() => setTempleForm({ id: t.id, name: t.name, ...pickAddress(t), address: t.address, description: t.description, phone: t.phone, status: t.status === "active" ? "active" : "pending", banjarIds: t.banjarIds })}><Pencil className="h-4 w-4" /> Ubah data</Button>
                    <Button size="sm" variant="outline" onClick={() => setBankFor({ t, bankName: t.bankName ?? "", bankAccountNumber: t.bankAccountNumber ?? "", bankAccountHolder: t.bankAccountHolder ?? "" })}><Landmark className="h-4 w-4" /> Rekening</Button>
                    <Button size="sm" variant="outline" onClick={() => { setNewStaff({ email: "", name: "", role: "pengurus" }); setStaffFor({ kind: "temple", t }); }}><Users className="h-4 w-4" /> Pengurus</Button>
                  </div>
                </li>
              ))}
            </ul>
            {!data.temples.length && <EmptyState icon={Building2} title="Belum ada pura" description="Buat banjar terlebih dahulu, lalu tambahkan pura dan pilih banjar pengemponnya." />}
          </Card>
        </div>
      )}

      {data && tab === "banjar" && (
        <div className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button size="lg" onClick={() => setBanjarForm({ ...emptyBanjar })}><Plus className="h-5 w-5" /> Tambah banjar</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {data.banjars.map((b) => {
              const temples = data.temples.filter((t) => t.banjarIds.includes(b.id));
              const members = data.banjarMembers.filter((m) => m.banjarId === b.id && m.status === "active");
              return (
                <Card key={b.id} className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold">{b.name}</h2>
                      <p className="text-sm text-muted">{[b.village, b.district, b.regency].filter(Boolean).join(", ")}</p>
                    </div>
                    {b.status !== "active" && <Badge tone="gray">Nonaktif</Badge>}
                  </div>
                  <p className="mt-3 text-sm font-semibold">Pura yang diempon ({temples.length})</p>
                  <p className="text-sm text-muted">{temples.map((t) => t.name).join(", ") || "Belum ada"}</p>
                  <p className="mt-3 text-sm font-semibold">Pengurus Banjar ({members.length})</p>
                  <p className="text-sm text-muted">{members.map((m) => userById(m.userId)?.name).join(", ") || "Belum ada"}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setBanjarForm({ id: b.id, name: b.name, ...pickAddress(b), address: b.address ?? "", status: b.status })}><Pencil className="h-4 w-4" /> Ubah</Button>
                    <Button size="sm" variant="outline" onClick={() => { setNewStaff({ email: "", name: "", role: "pengurus" }); setStaffFor({ kind: "banjar", b }); }}><Users className="h-4 w-4" /> Pengurus Banjar</Button>
                  </div>
                </Card>
              );
            })}
          </div>
          {!data.banjars.length && <Card><EmptyState icon={Building2} title="Belum ada banjar" description="Mulai dengan menambahkan Banjar Pengempon." /></Card>}
        </div>
      )}

      {data && tab === "akun" && (
        <div className="mt-4">
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input aria-label="Cari akun" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau email…" className="h-12 w-full rounded-xl border border-line bg-white pl-12 pr-4 text-[16px] focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15" />
          </div>
          <Card>
            <ul className="divide-y divide-line">
              {users.map((u) => {
                const roles = rolesOf(u);
                return (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                    <Avatar name={u.name} color={u.avatarColor} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-bold">
                        {u.name} {u.id === me && <span className="text-sm font-medium text-muted">(Anda)</span>}
                        {u.isSuperAdmin && <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", ROLE_TONE.superadmin)}><Crown className="h-3 w-3" /> Admin Utama</span>}
                        {u.status === "disabled" && <Badge tone="red">Nonaktif</Badge>}
                      </p>
                      <p className="text-sm text-muted">{u.email} · {u.lastLoginAt ? `terakhir masuk ${relativeTime(u.lastLoginAt)}` : "belum pernah masuk"}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {roles.map((r) => <span key={r.key} className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ROLE_TONE[r.role])}>{ROLE_LABEL[r.role]} · {r.where}</span>)}
                        {!u.isSuperAdmin && !roles.length && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">Umat</span>}
                      </div>
                    </div>
                    {u.isSuperAdmin ? (
                      <span className="flex items-center gap-1.5 text-sm text-muted"><ShieldCheck className="h-4 w-4" /> Dilindungi</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                      {u.status !== "deleted" && <Button size="sm" variant="ghost" onClick={() => { setNewEmail(""); setEmailFor(u); }}><Mail className="h-4 w-4" /> Ganti email</Button>}
                      <Button size="sm" variant={u.status === "disabled" ? "secondary" : "ghost"} className={u.status === "disabled" ? "" : "text-expense"} onClick={() => setStatusFor(u)}>
                        {u.status === "disabled" ? <><UserCheck className="h-4 w-4" /> Aktifkan</> : <><UserX className="h-4 w-4" /> Nonaktifkan</>}
                      </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
          <p className="mt-3 text-sm text-muted">Peran pengurus diatur dari tab Pura (Pengurus) dan tab Banjar (Pengurus Banjar). &ldquo;Nonaktifkan&rdquo; langsung mengeluarkan orang itu dari semua perangkat.</p>
        </div>
      )}

      {data && tab === "cadangan" && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader title="Unduh cadangan sekarang" description="Semua data dalam satu file (tanpa foto)." />
            <CardBody className="space-y-3">
              <a href="/api/admin/backup" className={buttonClass("primary", "lg", "w-full")} onClick={() => toast("Menyiapkan file cadangan…")}><Download className="h-5 w-5" /> Unduh cadangan (.json)</a>
              <p className="text-sm text-muted">Lakukan setiap minggu. Simpan di Google Drive pribadi. File berisi data keuangan — jangan dibagikan.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Cadangan lengkap & pemulihan" />
            <CardBody className="space-y-2 text-[15px] text-charcoal/80">
              <p className="flex gap-2"><DatabaseBackup className="h-5 w-5 shrink-0 text-emerald-700" /> Database Neon (paket gratis) hanya menyimpan riwayat 6 jam terakhir, jadi cadangan mingguan tetap penting.</p>
              <p>Cadangan lengkap beserta foto bukti: jalankan <code className="rounded bg-stone-100 px-1.5">npm run backup</code> di laptop. Lihat docs/PANDUAN.md.</p>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Temple form */}
      <Dialog
        open={!!templeForm}
        onClose={() => setTempleForm(null)}
        title={templeForm?.id ? "Ubah data pura" : "Tambah pura"}
        footer={<Button size="lg" className="w-full" loading={busy} onClick={async () => { if (!templeForm) return; const { id, ...rest } = templeForm; if (await done(run("adminSaveTemple", { ...rest, id: id || undefined }), id ? "Data pura disimpan" : "Pura ditambahkan")) setTempleForm(null); }}>Simpan</Button>}
      >
        {templeForm && (
          <div className="space-y-4">
            <p className="rounded-xl bg-ivory p-3 text-sm text-muted">Wajib: nama pura dan banjar pengempon. Pura tidak perlu email — email hanya untuk pengurus yang masuk. Rekening diisi lewat tombol <b>Rekening</b> setelah pura disimpan; tanpa rekening umat belum bisa berpunia.</p>
            <Field label="Nama pura" htmlFor="tp-name" required><Input id="tp-name" value={templeForm.name} onChange={(e) => setTempleForm({ ...templeForm, name: e.target.value })} placeholder="Pura Dalem …" /></Field>
            <Field label="Banjar Pengempon" required hint="Boleh lebih dari satu. Pengurus semua banjar yang dipilih dapat membuka pura ini.">
              <div className="space-y-2">
                {data?.banjars.map((b) => (
                  <label key={b.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                    <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={templeForm.banjarIds.includes(b.id)} onChange={(e) => setTempleForm({ ...templeForm, banjarIds: e.target.checked ? [...templeForm.banjarIds, b.id] : templeForm.banjarIds.filter((x) => x !== b.id) })} />
                    <span className="font-semibold">{b.name}</span>
                  </label>
                ))}
              </div>
            </Field>
            <fieldset className="space-y-3 rounded-2xl border border-line p-4">
              <legend className="px-1 text-[15px] font-bold">Lokasi pura (opsional)</legend>
              <WilayahPicker idPrefix="tp" value={pickAddress(templeForm)} onChange={(a) => setTempleForm({ ...templeForm, ...a })} />
            </fieldset>
            <Field label="Alamat detail (opsional)" hint="Jalan, nomor, gang, dusun/banjar dinas, patokan." htmlFor="tp-addr"><Input id="tp-addr" value={templeForm.address} onChange={(e) => setTempleForm({ ...templeForm, address: e.target.value })} /></Field>
            <Field label="Catatan / deskripsi (opsional)" htmlFor="tp-desc"><Textarea id="tp-desc" rows={3} value={templeForm.description} onChange={(e) => setTempleForm({ ...templeForm, description: e.target.value })} /></Field>
            <Field label="Telepon / WA kontak (opsional)" htmlFor="tp-phone"><Input id="tp-phone" value={templeForm.phone} onChange={(e) => setTempleForm({ ...templeForm, phone: e.target.value })} /></Field>
            <Field label="Status" htmlFor="tp-status">
              <Select id="tp-status" value={templeForm.status} onChange={(e) => setTempleForm({ ...templeForm, status: e.target.value as "active" | "pending" })}>
                <option value="active">Aktif — tampil untuk umat</option>
                <option value="pending">Nonaktif — tersembunyi dari umat</option>
              </Select>
            </Field>
          </div>
        )}
      </Dialog>

      {/* Banjar form */}
      <Dialog
        open={!!banjarForm}
        onClose={() => setBanjarForm(null)}
        title={banjarForm?.id ? "Ubah banjar" : "Tambah banjar"}
        footer={<Button size="lg" className="w-full" loading={busy} onClick={async () => { if (!banjarForm) return; const { id, ...rest } = banjarForm; if (await done(run("saveBanjar", { ...rest, id: id || undefined }), "Banjar disimpan")) setBanjarForm(null); }}>Simpan</Button>}
      >
        {banjarForm && (
          <div className="space-y-4">
            <Field label="Nama banjar" htmlFor="bj-name"><Input id="bj-name" value={banjarForm.name} onChange={(e) => setBanjarForm({ ...banjarForm, name: e.target.value })} placeholder="Banjar Adat …" /></Field>
            <fieldset className="space-y-3 rounded-2xl border border-line p-4">
              <legend className="px-1 text-[15px] font-bold">Wilayah banjar (opsional)</legend>
              <p className="text-sm text-muted">Kode wilayah dipakai nanti untuk ringkasan per desa/kecamatan/kabupaten.</p>
              <WilayahPicker idPrefix="bj" value={pickAddress(banjarForm)} onChange={(a) => setBanjarForm({ ...banjarForm, ...a })} />
            </fieldset>
            <Field label="Alamat detail (opsional)" hint="Jalan, nomor, gang, dusun, patokan." htmlFor="bj-addr">
              <Input id="bj-addr" value={banjarForm.address} onChange={(e) => setBanjarForm({ ...banjarForm, address: e.target.value })} />
            </Field>
            <Field label="Status" htmlFor="bj-status">
              <Select id="bj-status" value={banjarForm.status} onChange={(e) => setBanjarForm({ ...banjarForm, status: e.target.value as "active" | "inactive" })}>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif (Pengurus Banjar kehilangan akses)</option>
              </Select>
            </Field>
          </div>
        )}
      </Dialog>

      {/* Bank */}
      <Dialog open={!!bankFor} onClose={() => setBankFor(null)} title="Info rekening pura" description={bankFor?.t.name} footer={<Button size="lg" className="w-full" onClick={() => setBankConfirm(true)}>Simpan rekening</Button>}>
        {bankFor && (
          <div className="space-y-4">
            <p className="rounded-xl bg-mint/60 p-3 text-sm text-emerald-900">Rekening ini ditampilkan ke umat untuk transfer punia. Hanya Admin Utama yang dapat mengubahnya, dan setiap perubahan tercatat di Log Aktivitas.</p>
            <Field label="Nama bank" htmlFor="bk-name"><Input id="bk-name" value={bankFor.bankName} onChange={(e) => setBankFor({ ...bankFor, bankName: e.target.value })} placeholder="Bank NTB Syariah, BRI, …" /></Field>
            <Field label="Nomor rekening" htmlFor="bk-no"><Input id="bk-no" inputMode="numeric" value={bankFor.bankAccountNumber} onChange={(e) => setBankFor({ ...bankFor, bankAccountNumber: e.target.value })} /></Field>
            <Field label="Nama pemilik rekening (atas nama)" htmlFor="bk-holder" hint="Ditampilkan ke umat, misalnya &quot;Pengurus Pura Dalem …&quot;."><Input id="bk-holder" value={bankFor.bankAccountHolder} onChange={(e) => setBankFor({ ...bankFor, bankAccountHolder: e.target.value })} /></Field>
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={bankConfirm}
        onClose={() => setBankConfirm(false)}
        title="Simpan info rekening?"
        description={bankFor && <>Umat akan mentransfer punia ke <strong>{bankFor.bankName} {bankFor.bankAccountNumber}</strong> a.n. <strong>{bankFor.bankAccountHolder}</strong>. Pastikan sudah benar.</>}
        confirmLabel="Ya, simpan"
        onConfirm={async () => {
          if (!bankFor) return;
          setBankConfirm(false);
          if (await done(run("setTempleBank", { templeId: bankFor.t.id, bankName: bankFor.bankName, bankAccountNumber: bankFor.bankAccountNumber, bankAccountHolder: bankFor.bankAccountHolder }), "Info rekening disimpan")) setBankFor(null);
        }}
      />

      {/* Staff */}
      <Dialog open={!!staffFor} onClose={() => setStaffFor(null)} title={staffFor?.kind === "temple" ? `Pengurus ${staffFor.t.name}` : `Pengurus Banjar — ${staffFor?.kind === "banjar" ? staffFor.b.name : ""}`} description="Daftarkan lewat email. Orang tersebut masuk dengan Google atau tautan email memakai alamat yang sama.">
        {staffFor && data && (
          <div className="space-y-4 pb-2">
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {(staffFor.kind === "temple"
                ? data.memberships.filter((m) => m.templeId === staffFor.t.id).map((m) => ({ id: m.id, kind: "temple" as const, user: userById(m.userId), role: m.role, position: m.position, positionTitle: m.positionTitle }))
                : data.banjarMembers.filter((m) => m.banjarId === staffFor.b.id).map((m) => ({ id: m.id, kind: "banjar" as const, user: userById(m.userId), role: "banjar" as const, position: m.position, positionTitle: m.positionTitle }))
              ).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.user?.name ?? "—"} {r.user?.status === "disabled" && <Badge tone="red">Nonaktif</Badge>}</p>
                    <p className="truncate text-sm text-muted">{r.user?.email}</p>
                    <PositionPicker
                      id={`jabatan-${r.id}`}
                      kind={r.kind}
                      position={r.position}
                      title={r.positionTitle}
                      onSave={(position, title) => done(run("adminSetPosition", { kind: r.kind, id: r.id, position, title }), "Jabatan disimpan")}
                    />
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ROLE_TONE[r.role])}>{ROLE_LABEL[r.role]}</span>
                  <button className="grid h-9 w-9 place-items-center rounded-lg text-expense hover:bg-red-50" aria-label="Cabut peran" onClick={() => setRemoveStaff({ kind: r.kind, id: r.id, label: `${r.user?.name} (${ROLE_LABEL[r.role]})` })}><X className="h-4 w-4" /></button>
                </li>
              ))}
              {staffFor.kind === "temple" && data.memberships.filter((m) => m.templeId === staffFor.t.id).length === 0 && <li className="p-3 text-sm text-muted">Pengurus pura belum terdaftar. Punia akan diverifikasi oleh Pengurus Banjar.</li>}
              {staffFor.kind === "banjar" && data.banjarMembers.filter((m) => m.banjarId === staffFor.b.id).length === 0 && <li className="p-3 text-sm text-muted">Belum ada Pengurus Banjar.</li>}
            </ul>
            <div className="rounded-2xl bg-ivory p-4">
              <p className="mb-3 flex items-center gap-2 font-bold"><UserPlus className="h-5 w-5 text-emerald-700" /> Daftarkan pengurus</p>
              <div className="space-y-3">
                <Field label="Email" htmlFor="st-email"><Input id="st-email" type="email" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} placeholder="nama@gmail.com" /></Field>
                <Field label="Nama (opsional)" htmlFor="st-name"><Input id="st-name" value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} /></Field>
                {staffFor.kind === "temple" && (
                  <Field label="Peran" htmlFor="st-role">
                    <Select id="st-role" value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as "pengurus" | "pemeriksa" })}>
                      <option value="pengurus">Pengurus Pura</option>
                      <option value="pemeriksa">Pemeriksa (lihat saja)</option>
                    </Select>
                  </Field>
                )}
                <Button
                  className="w-full"
                  size="lg"
                  loading={busy}
                  disabled={!newStaff.email.includes("@")}
                  onClick={async () => {
                    const payload = staffFor.kind === "temple"
                      ? { email: newStaff.email, name: newStaff.name || undefined, kind: newStaff.role, templeId: staffFor.t.id }
                      : { email: newStaff.email, name: newStaff.name || undefined, kind: "banjar", banjarId: staffFor.b.id };
                    if (await done(run("adminAddStaff", payload), "Pengurus didaftarkan")) setNewStaff({ email: "", name: "", role: "pengurus" });
                  }}
                >
                  Daftarkan
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>
      <ConfirmDialog open={!!removeStaff} onClose={() => setRemoveStaff(null)} tone="danger" title="Cabut peran ini?" description={removeStaff?.label} confirmLabel="Cabut peran" onConfirm={async () => { if (!removeStaff) return; const r = removeStaff; setRemoveStaff(null); await done(run("adminRemoveStaff", { kind: r.kind, id: r.id }), "Peran dicabut"); }} />
      <Dialog
        open={!!emailFor}
        onClose={() => setEmailFor(null)}
        title={`Ganti email ${emailFor?.name ?? ""}`}
        description={`Email sekarang: ${emailFor?.email ?? ""}`}
        footer={
          <Button size="lg" className="w-full" loading={busy} disabled={!newEmail.includes("@")} onClick={async () => {
            if (!emailFor) return;
            if (await done(run("adminChangeEmail", { userId: emailFor.id, email: newEmail }), "Email diganti. Sesi lama sudah dikeluarkan.")) setEmailFor(null);
          }}>Ganti email</Button>
        }
      >
        <div className="space-y-3 text-[15px]">
          <Field label="Email baru" htmlFor="ce-email"><Input id="ce-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="nama@gmail.com" /></Field>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>Akunnya tetap sama: peran, pura yang dipegang, dan riwayatnya tidak berubah.</li>
            <li>Orang itu langsung dikeluarkan dari semua perangkat, lalu masuk lagi memakai email baru.</li>
            <li>Perubahan dicatat di Log Aktivitas (email lama, email baru, oleh siapa, kapan).</li>
          </ul>
        </div>
      </Dialog>
      <ConfirmDialog
        open={!!statusFor}
        onClose={() => setStatusFor(null)}
        tone={statusFor?.status === "disabled" ? "primary" : "danger"}
        title={statusFor?.status === "disabled" ? `Aktifkan kembali ${statusFor?.name}?` : `Nonaktifkan ${statusFor?.name}?`}
        description={statusFor?.status === "disabled" ? "Orang ini dapat masuk kembali." : "Orang ini langsung dikeluarkan dari semua perangkat dan tidak dapat masuk. Catatan yang pernah dibuatnya tetap tersimpan."}
        confirmLabel={statusFor?.status === "disabled" ? "Aktifkan" : "Nonaktifkan"}
        onConfirm={async () => {
          if (!statusFor) return;
          const u = statusFor;
          setStatusFor(null);
          await done(run("adminSetUserStatus", { userId: u.id, status: u.status === "disabled" ? "active" : "disabled" }), u.status === "disabled" ? "Akun diaktifkan" : "Akun dinonaktifkan");
        }}
      />
    </div>
  );
}

/**
 * Jabatan of one person in this kepengurusan (temple or banjar). Saved immediately on change;
 * "Lainnya" asks for the title first. Only Admin Utama sees this (Back Office).
 */
function PositionPicker({ id, kind, position, title, onSave }: {
  id: string;
  kind: "temple" | "banjar";
  position?: Position;
  title?: string;
  onSave: (position: Position | null, title?: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState<string>(position ?? "");
  const [custom, setCustom] = useState(title ?? "");
  useEffect(() => { setValue(position ?? ""); setCustom(title ?? ""); }, [position, title]);
  const options = kind === "temple" ? TEMPLE_POSITIONS : BANJAR_POSITIONS;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-muted">Jabatan</label>
      <Select
        id={id}
        className="h-10 w-auto min-w-[9rem] py-0 text-sm"
        value={value}
        onChange={async (e) => {
          const v = e.target.value;
          setValue(v);
          if (v !== "lainnya" && !(await onSave((v || null) as Position | null))) setValue(position ?? "");
        }}
      >
        <option value="">— Belum diisi —</option>
        {options.map((o) => <option key={o} value={o}>{POSITION_LABEL[o]}</option>)}
      </Select>
      {value === "lainnya" && (
        <>
          <Input aria-label="Nama jabatan" className="h-10 w-40 text-sm" value={custom} maxLength={60} onChange={(e) => setCustom(e.target.value)} placeholder="mis. Wakil Ketua" />
          <Button size="sm" variant="outline" disabled={!custom.trim() || (position === "lainnya" && custom === (title ?? ""))} onClick={() => onSave("lainnya", custom.trim())}>Simpan</Button>
        </>
      )}
    </div>
  );
}
