"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Building2, ChevronRight, Eye, FileText, KeyRound, Landmark, Palette, Plus, Tags, UserRound, Users, Archive, ArchiveRestore, Pencil, LogOut, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { useCan, useWorkspace } from "@/components/app/hooks";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm";
import { MoneyInput } from "@/components/ui/money-input";
import { ImageUpload } from "@/components/ui/file-upload";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { TempleCover } from "@/components/brand/temple-cover";
import { ICONS } from "@/components/app/tx-row";
import { useCurrentUser, useStore } from "@/lib/store";
import { accountBalance } from "@/lib/ledger";
import { cn, rupiah } from "@/lib/format";
import type { Account, Category, CoverVariant, Temple } from "@/lib/types";
import { InstallAppButton } from "@/components/pwa";
import type { Result } from "@/lib/store";

/** Shows the right toast for a save result; returns true on success. */
function done(r: Result<unknown>, msg: string) {
  if (r.ok) toast.success(msg);
  else toast.error(r.error);
  return r.ok;
}

const TABS = [
  { key: "profil-pura", label: "Profil pura", icon: Building2 },
  { key: "profil-admin", label: "Profil saya", icon: UserRound },
  { key: "kategori", label: "Kategori keuangan", icon: Tags },
  { key: "rekening", label: "Kas & saldo awal", icon: Landmark },
  { key: "notifikasi", label: "Notifikasi", icon: Bell },
  { key: "transparansi", label: "Tampilan untuk umat", icon: Eye },
  { key: "keamanan", label: "Keamanan", icon: KeyRound },
  { key: "branding", label: "Kop laporan", icon: FileText },
  { key: "tampilan", label: "Tampilan", icon: Palette },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function Settings() {
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey | null>((params.get("tab") as TabKey) ?? null);
  useEffect(() => setTab((params.get("tab") as TabKey) ?? null), [params]);
  const go = (k: TabKey | null) => {
    router.replace(k ? `/app/pengaturan?tab=${k}` : "/app/pengaturan", { scroll: false });
    setTab(k);
  };
  const active = tab ?? "profil-pura";

  return (
    <div>
      <PageHeader title="Pengaturan" description="Atur profil pura, rekening, kategori, dan keterbukaan informasi." />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav className={cn("lg:block", tab ? "hidden" : "block")} aria-label="Bagian pengaturan">
          <Card className="overflow-hidden p-1.5">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => go(t.key)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-semibold", active === t.key ? "lg:bg-mint lg:text-emerald-900" : "hover:bg-ivory")}>
                <t.icon className="h-5 w-5 text-emerald-700" /> <span className="flex-1">{t.label}</span> <ChevronRight className="h-4 w-4 text-muted lg:hidden" />
              </button>
            ))}
          </Card>
        </nav>
        <div className={cn(tab ? "block" : "hidden lg:block")}>
          {tab && <button onClick={() => go(null)} className="mb-3 text-sm font-semibold text-emerald-700 lg:hidden">← Semua pengaturan</button>}
          {active === "profil-pura" && <TempleProfile />}
          {active === "profil-admin" && <AdminProfile />}
          {active === "kategori" && <Categories />}
          {active === "rekening" && <Accounts />}
          {active === "notifikasi" && <NotifPrefs />}
          {active === "transparansi" && <Transparency />}
          {active === "keamanan" && <Security />}
          {active === "branding" && <Branding />}
          {active === "tampilan" && <Appearance />}
        </div>
      </div>
    </div>
  );
}

function ReadOnlyNote() {
  return <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Peran Anda hanya dapat melihat pengaturan ini.</p>;
}

function TempleProfile() {
  const { temple } = useWorkspace();
  const can = useCan();
  const banjars = useStore((s) => s.data.banjars);
  const update = useStore((s) => s.updateTemple);
  const [f, setF] = useState(temple!);
  const [confirm, setConfirm] = useState(false);
  const ro = !can("settings.manage");
  const covers: CoverVariant[] = ["emerald", "gold", "forest", "ocean", "dusk"];
  return (
    <Card>
      <CardHeader title="Profil pura" description="Tampil di halaman pura untuk umat." />
      <CardBody className="space-y-4">
        {ro && <ReadOnlyNote />}
        <div className="rounded-2xl bg-ivory p-4 text-[15px]">
          <p className="font-bold">{temple!.name}</p>
          <p className="text-muted">{temple!.address} · {temple!.village}, {temple!.district}, {temple!.regency}</p>
          <p className="mt-1 text-muted">Banjar Pengempon: {banjars.filter((b) => temple!.banjarIds?.includes(b.id)).map((b) => b.name).join(", ") || "—"}</p>
          <p className="mt-2 text-sm text-muted">Nama, lokasi, banjar pengempon dan rekening diatur Admin Utama di Back Office.</p>
        </div>
        <Field label="Deskripsi" htmlFor="t-desc"><Textarea id="t-desc" disabled={ro} rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telepon / WhatsApp" htmlFor="t-phone"><Input id="t-phone" disabled={ro} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Email" htmlFor="t-email"><Input id="t-email" disabled={ro} value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        </div>
        <Field label="Sampul">
          <div className="flex flex-wrap gap-2">
            {covers.map((c) => (
              <button key={c} type="button" disabled={ro} onClick={() => setF({ ...f, cover: c, photo: undefined })} className={cn("overflow-hidden rounded-xl ring-offset-2", f.cover === c && !f.photo && "ring-2 ring-emerald-600")} aria-label={`Sampul ${c}`}>
                <TempleCover variant={c} className="h-14 w-24" />
              </button>
            ))}
          </div>
          {!ro && <div className="mt-3"><ImageUpload value={f.photo} onChange={(v) => setF({ ...f, photo: v })} label="Foto pura" compact /></div>}
        </Field>
        {!ro && <div className="flex justify-end"><Button size="lg" onClick={() => setConfirm(true)}>Simpan perubahan</Button></div>}
      </CardBody>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Simpan profil pura?" description="Perubahan langsung tampil di halaman pura untuk umat." onConfirm={async () => { const r = await update({ description: f.description, phone: f.phone, email: f.email, cover: f.cover, photo: f.photo ?? null } as Partial<Temple>); setConfirm(false); done(r, "Profil pura disimpan"); }} />
    </Card>
  );
}

function AdminProfile() {
  const user = useCurrentUser();
  const update = useStore((s) => s.updateUser);
  const [f, setF] = useState({ name: user?.name ?? "", callName: user?.callName ?? "", phone: user?.phone ?? "" });
  return (
    <Card>
      <CardHeader title="Profil saya" />
      <CardBody className="space-y-4">
        <Field label="Nama lengkap" htmlFor="u-name"><Input id="u-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Nama sapaan" htmlFor="u-call" hint='Dipakai pada sapaan dashboard, mis. "Pak Made".'><Input id="u-call" value={f.callName} onChange={(e) => setF({ ...f, callName: e.target.value })} /></Field>
        <Field label="Nomor WhatsApp" htmlFor="u-phone"><Input id="u-phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Email" htmlFor="u-email" hint="Email dipakai untuk masuk (Google atau tautan email). Hubungi Admin Utama bila perlu diganti."><Input id="u-email" disabled value={user?.email ?? ""} /></Field>
        <div className="flex justify-end"><Button size="lg" disabled={f.name.trim().length < 3} onClick={async () => done(await update(f), "Profil disimpan")}>Simpan</Button></div>
      </CardBody>
    </Card>
  );
}

function Categories() {
  const ws = useWorkspace();
  const can = useCan();
  const save = useStore((s) => s.saveCategory);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [edit, setEdit] = useState<Partial<Category> | null>(null);
  const ro = !can("settings.manage");
  const list = ws.categories.filter((c) => c.type === type);
  return (
    <Card>
      <CardHeader title="Kategori keuangan" description="Gunakan nama yang mudah dipahami pengurus." action={!ro && <Button size="sm" onClick={() => setEdit({ type, icon: type === "income" ? "CirclePlus" : "CircleMinus", name: "" })}><Plus className="h-4 w-4" /> Tambah</Button>} />
      <CardBody>
        <Segmented value={type} onChange={setType} options={[{ value: "expense", label: "Pengeluaran" }, { value: "income", label: "Pemasukan" }]} ariaLabel="Jenis kategori" />
        <ul className="mt-4 divide-y divide-line">
          {list.map((c) => {
            const Icon = ICONS[c.icon] ?? Tags;
            const used = ws.transactions.filter((t) => t.categoryId === c.id).length;
            return (
              <li key={c.id} className={cn("flex items-center gap-3 py-3", c.archived && "opacity-50")}>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-ivory text-emerald-700"><Icon className="h-5 w-5" /></span>
                <span className="flex-1"><span className="block font-semibold">{c.name}</span><span className="text-sm text-muted">{used} transaksi{c.archived ? " · diarsipkan" : ""}</span></span>
                {!ro && <Button variant="ghost" size="icon" onClick={() => setEdit(c)} aria-label={`Ubah ${c.name}`}><Pencil className="h-4 w-4" /></Button>}
                {!ro && <Button variant="ghost" size="icon" onClick={async () => done(await save({ ...c, archived: !c.archived }), c.archived ? "Kategori diaktifkan" : "Kategori diarsipkan")} aria-label={c.archived ? "Aktifkan" : "Arsipkan"}>{c.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</Button>}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-muted">Kategori yang sudah dipakai tidak dihapus, hanya diarsipkan agar laporan lama tetap utuh.</p>
      </CardBody>
      <Dialog open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Ubah kategori" : "Kategori baru"} footer={<Button size="lg" className="w-full" disabled={(edit?.name ?? "").trim().length < 3} onClick={async () => { const r = await save({ name: edit!.name!.trim(), type: edit!.type!, icon: edit!.icon!, id: edit!.id, archived: edit!.archived }); if (done(r, "Kategori disimpan")) setEdit(null); }}>Simpan</Button>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Nama kategori" htmlFor="k-name"><Input id="k-name" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Ikon">
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(ICONS).map(([k, Icon]) => (
                  <button key={k} type="button" onClick={() => setEdit({ ...edit, icon: k })} className={cn("grid h-12 place-items-center rounded-xl border", edit.icon === k ? "border-emerald-500 bg-mint" : "border-line")} aria-label={k}><Icon className="h-5 w-5" /></button>
                ))}
              </div>
            </Field>
          </div>
        )}
      </Dialog>
    </Card>
  );
}

function Accounts() {
  const ws = useWorkspace();
  const can = useCan();
  const save = useStore((s) => s.saveAccount);
  const [edit, setEdit] = useState<Partial<Account> | null>(null);
  const ro = !can("settings.manage");
  const hasTx = (id?: string) => !!id && ws.transactions.some((t) => t.accountId === id || t.toAccountId === id);
  const t = ws.temple!;
  return (
    <Card>
      <CardHeader title="Kas & saldo awal" description="Saldo dihitung dari saldo awal ditambah semua transaksi — tidak pernah diketik manual." action={!ro && <Button size="sm" onClick={() => setEdit({ type: "cash", name: "", openingBalance: 0, openingDate: `${new Date().getFullYear()}-01-01` })}><Plus className="h-4 w-4" /> Tambah</Button>} />
      <CardBody className="space-y-3">
        <div className="rounded-2xl border border-emerald-200 bg-mint/40 p-4">
          <p className="flex items-center gap-2 font-bold"><Landmark className="h-5 w-5 text-emerald-700" /> Rekening resmi untuk punia</p>
          {t.bankAccountNumber ? (
            <p className="mt-1 text-[15px]">{t.bankName} · <span className="tabular font-semibold">{t.bankAccountNumber}</span> · a.n. {t.bankAccountHolder}</p>
          ) : (
            <p className="mt-1 text-[15px] text-amber-800">Belum diisi — umat belum bisa berpunia lewat aplikasi.</p>
          )}
          <p className="mt-1 text-sm text-muted">Hanya Admin Utama yang dapat mengubah rekening ini (tercatat di Log Aktivitas).</p>
        </div>
        {ws.accounts.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-4">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-ivory text-emerald-700"><Landmark className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{a.name}</p>
              <p className="text-sm text-muted">{a.type === "cash" ? "Kas tunai" : "Rekening bank"} · saldo awal {rupiah(a.openingBalance)}</p>
            </div>
            <div className="text-right"><p className="text-xs text-muted">Saldo menurut catatan</p><p className="tabular font-extrabold">{rupiah(accountBalance(a, ws.transactions))}</p></div>
            {!ro && <Button variant="ghost" size="icon" onClick={() => setEdit(a)} aria-label={`Ubah ${a.name}`}><Pencil className="h-4 w-4" /></Button>}
          </div>
        ))}
        <p className="text-sm text-muted">Isi <strong>saldo awal</strong> sesuai uang yang ada saat mulai memakai PURA. Saldo awal terkunci setelah ada transaksi.</p>
      </CardBody>
      <Dialog open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Ubah kas" : "Kas baru"} footer={<Button size="lg" className="w-full" disabled={(edit?.name ?? "").trim().length < 3} onClick={async () => { const r = await save({ ...(edit as Account), name: edit!.name!.trim() }); if (done(r, "Tersimpan")) setEdit(null); }}>Simpan</Button>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Nama" htmlFor="ac-name"><Input id="ac-name" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Kas Tunai Pura" /></Field>
            <Field label="Jenis" htmlFor="ac-type"><Select id="ac-type" value={edit.type} disabled={hasTx(edit.id)} onChange={(e) => setEdit({ ...edit, type: e.target.value as Account["type"] })}><option value="cash">Kas tunai</option><option value="bank">Rekening bank</option></Select></Field>
            <Field label="Saldo awal" hint={hasTx(edit.id) ? "Saldo awal terkunci karena sudah ada transaksi. Gunakan transaksi koreksi bila perlu." : "Jumlah uang saat mulai memakai PURA."}>
              {hasTx(edit.id) ? <Input disabled value={rupiah(edit.openingBalance ?? 0)} /> : <MoneyInput value={edit.openingBalance ?? 0} onChange={(v) => setEdit({ ...edit, openingBalance: v })} />}
            </Field>
            <Field label="Per tanggal" htmlFor="ac-date"><Input id="ac-date" type="date" disabled={hasTx(edit.id)} value={edit.openingDate ?? ""} onChange={(e) => setEdit({ ...edit, openingDate: e.target.value })} /></Field>
          </div>
        )}
      </Dialog>
    </Card>
  );
}

function NotifPrefs() {
  const prefs = useStore((s) => s.prefs);
  const me = useStore((s) => s.me);
  const setPrefs = useStore((s) => s.setPreferences);
  const updateUser = useStore((s) => s.updateUser);
  const n = prefs.notifications;
  const set = (k: keyof typeof n, v: boolean) => { setPrefs({ notifications: { ...n, [k]: v } }); toast.success("Preferensi disimpan"); };
  return (
    <Card>
      <CardHeader title="Notifikasi" description="Pilih kabar yang ingin Anda terima." />
      <CardBody className="divide-y divide-line py-1">
        <Switch checked={me?.emailDigest !== false} onChange={async (v) => done(await updateUser({ emailDigest: v }), "Preferensi email disimpan")} label="Email ringkasan punia (maks. sekali sehari)" description="Dikirim hanya jika ada punia yang menunggu verifikasi." />
        <Switch checked={n.donationPending} onChange={(v) => set("donationPending", v)} label="Punia baru menunggu verifikasi (di aplikasi)" />
        <Switch checked={n.campaignTarget} onChange={(v) => set("campaignTarget", v)} label="Target penggalangan tercapai" />
        <Switch checked={n.approvals} onChange={(v) => set("approvals", v)} label="Transaksi menunggu persetujuan" />
        <Switch checked={n.reportReady} onChange={(v) => set("reportReady", v)} label="Laporan dipublikasikan" />
      </CardBody>
    </Card>
  );
}

function Transparency() {
  const { temple } = useWorkspace();
  const can = useCan();
  const update = useStore((s) => s.updateTemple);
  const t = { showBalance: true, showRecentTransactions: true, recentCount: 5, ...temple!.transparency };
  const ro = !can("settings.manage");
  const save = async (patch: Partial<typeof t>) => done(await update({ transparency: { ...t, ...patch } }), "Pengaturan tampilan umat disimpan");
  const toggles: { k: "showBalance" | "showRecentTransactions" | "showDonorList" | "showCampaigns" | "showPublishedSummaries" | "showPublicProfile"; label: string; desc: string }[] = [
    { k: "showBalance", label: "Tampilkan posisi kas", desc: "Saldo berdasarkan pencatatan pengurus (bukan saldo bank)." },
    { k: "showRecentTransactions", label: "Tampilkan transaksi terakhir", desc: "Pemasukan dan pengeluaran terbaru." },
    { k: "showDonorList", label: "Tampilkan daftar punia", desc: "Punia terverifikasi. Donatur anonim tetap tampil sebagai \"Anonim\"." },
    { k: "showCampaigns", label: "Tampilkan penggalangan dana", desc: "Kegiatan/odalan yang dipublikasikan." },
    { k: "showPublishedSummaries", label: "Tampilkan laporan yang dipublikasikan", desc: "Hanya laporan yang Anda publikasikan." },
    { k: "showPublicProfile", label: "Tampilkan pura di daftar pura", desc: "Jika dimatikan, halaman pura disembunyikan dari umat." },
  ];
  return (
    <Card>
      <CardHeader title="Tampilan untuk umat" description="Atur apa saja yang terlihat di halaman pura. Nilai awal: semua tampil." />
      <CardBody className="py-1">
        {ro && <ReadOnlyNote />}
        <div className="divide-y divide-line">
          {toggles.map((x) => (
            <Switch key={x.k} checked={t[x.k] !== false} disabled={ro} onChange={(v) => save({ [x.k]: v })} label={x.label} description={x.desc} />
          ))}
        </div>
        <div className="border-t border-line py-4">
          <p className="font-semibold">Jumlah transaksi terakhir yang tampil</p>
          <div className="mt-2"><Segmented value={String(t.recentCount ?? 5) as "3" | "4" | "5"} onChange={(v) => !ro && save({ recentCount: Number(v) })} ariaLabel="Jumlah transaksi" options={[{ value: "3", label: "3" }, { value: "4", label: "4" }, { value: "5", label: "5" }]} /></div>
        </div>
      </CardBody>
      <div className="border-t border-line p-5"><Link href={`/pura/${temple!.slug}`} target="_blank" className={buttonClass("outline")}><Eye className="h-4 w-4" /> Lihat halaman pura</Link></div>
    </Card>
  );
}

function Security() {
  const session = useStore((s) => s.session);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  return (
    <Card>
      <CardHeader title="Keamanan" />
      <CardBody className="space-y-5">
        <div className="rounded-2xl bg-mint/50 p-4 text-sm text-emerald-900">
          <ul className="list-disc space-y-1 pl-5">
            <li>Masuk tanpa kata sandi: lewat Google atau tautan email sekali pakai (berlaku 15 menit).</li>
            <li>Terlalu banyak percobaan gagal membuat login dikunci 15 menit.</li>
            <li>Sesi berakhir otomatis setelah 30 hari tidak dipakai. Akun yang dinonaktifkan langsung keluar.</li>
            <li>Semua login dan perubahan data tercatat di Log Aktivitas.</li>
          </ul>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-line p-4">
          <div><p className="font-semibold">Sesi di perangkat ini</p><p className="text-sm text-muted">Dimulai {session ? new Date(session.startedAt).toLocaleString("id-ID") : "—"}</p></div>
          <Button variant="outline" onClick={() => setConfirm(true)}><LogOut className="h-4 w-4" /> Keluar</Button>
        </div>
      </CardBody>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Keluar dari aplikasi?" onConfirm={() => router.push("/keluar")} confirmLabel="Keluar" />
    </Card>
  );
}

function Branding() {
  const { temple } = useWorkspace();
  const can = useCan();
  const update = useStore((s) => s.updateTemple);
  const [b, setB] = useState(temple!.branding);
  const ro = !can("settings.manage");
  return (
    <Card>
      <CardHeader title="Kop laporan" description="Dipakai pada PDF dan mode presentasi." />
      <CardBody className="space-y-4">
        <Field label="Judul laporan" htmlFor="b-title"><Input id="b-title" disabled={ro} value={b.headerTitle} onChange={(e) => setB({ ...b, headerTitle: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama penandatangan" htmlFor="b-name"><Input id="b-name" disabled={ro} value={b.signatoryName} onChange={(e) => setB({ ...b, signatoryName: e.target.value })} /></Field>
          <Field label="Jabatan" htmlFor="b-role"><Input id="b-role" disabled={ro} value={b.signatoryRole} onChange={(e) => setB({ ...b, signatoryRole: e.target.value })} /></Field>
        </div>
        <Field label="Catatan kaki" htmlFor="b-foot"><Input id="b-foot" disabled={ro} value={b.footerNote} onChange={(e) => setB({ ...b, footerNote: e.target.value })} /></Field>
        <div className="overflow-hidden rounded-2xl border border-line">
          <div className="bg-forest p-4 text-white"><p className="font-bold">{b.headerTitle}</p><p className="text-sm text-white/70">{temple!.name}</p></div>
          <div className="h-1 bg-gold" />
          <div className="flex justify-end p-4 text-right text-sm"><div><p className="text-muted">{b.signatoryRole}</p><p className="mt-6 font-bold">{b.signatoryName}</p></div></div>
        </div>
        {!ro && <div className="flex justify-end"><Button size="lg" onClick={async () => done(await update({ branding: b }), "Kop laporan disimpan")}>Simpan</Button></div>}
      </CardBody>
    </Card>
  );
}

function Appearance() {
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPreferences);

  const router = useRouter();
  return (
    <Card>
      <CardHeader title="Tampilan" description="Sesuaikan agar nyaman dibaca." />
      <CardBody className="space-y-5">
        <div>
          <p className="mb-2 font-semibold">Ukuran huruf</p>
          <Segmented value={prefs.textSize} onChange={(v) => setPrefs({ textSize: v })} options={[{ value: "normal", label: "Normal" }, { value: "large", label: "Besar" }]} ariaLabel="Ukuran huruf" />
        </div>
        <Switch checked={prefs.reduceMotion} onChange={(v) => setPrefs({ reduceMotion: v })} label="Kurangi animasi" description="Matikan sebagian besar animasi dan transisi." />
        <div className="rounded-2xl border border-line p-4">
          <p className="font-semibold">Pasang aplikasi di HP</p>
          <p className="text-sm text-muted">Tambahkan PURA ke layar utama agar bisa dibuka seperti aplikasi biasa.</p>
          <div className="mt-3"><InstallAppButton /></div>
        </div>
      </CardBody>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}
