"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronsUpDown,
  ExternalLink,
  FileBarChart2,
  Home,
  LogOut,
  Megaphone,
  Menu,
  Plus,
  ReceiptText,
  RotateCcw,
  UserCog,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PatternBg } from "@/components/brand/ornament";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm";
import { PrototypeNotice } from "@/components/shared/prototype-banner";
import { DemoButton, useDemo } from "@/components/demo/demo-tour";
import { useActiveTemple, useCurrentUser, useIsDemo, useMembership, useRole, useStore } from "@/lib/store";
import { ALL_ROLES, ROLE_LABEL, ROLE_TONE, can } from "@/lib/permissions";
import { cn, initials } from "@/lib/format";
import { NAV, isActive } from "./nav";
import { toast } from "sonner";

export function Avatar({ name, color, size = 40 }: { name: string; color?: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ background: color ?? "#087F6D", width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {initials(name)}
    </span>
  );
}

function useUnread() {
  const templeId = useStore((s) => s.session?.activeTempleId);
  return useStore((s) => s.data.notifications.reduce((n, x) => n + (x.templeId === templeId && !x.read && notificationVisible(x.kind, s.prefs.notifications) ? 1 : 0), 0));
}

/** Notification preferences decide what is shown (the server keeps every notification). */
export function notificationVisible(kind: string, p: { donationPending: boolean; campaignTarget: boolean; campaignEnding: boolean; approvals: boolean; reportReady: boolean }) {
  const map: Record<string, boolean> = { donation_pending: p.donationPending, target_reached: p.campaignTarget, campaign_ending: p.campaignEnding, tx_approval: p.approvals, report_ready: p.reportReady };
  return map[kind] ?? true;
}

function TempleSwitcher({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const temple = useActiveTemple();
  const userId = useStore((s) => s.session?.userId);
  const memberships = useStore((s) => s.data.memberships);
  const temples = useStore((s) => s.data.temples);
  const setActive = useStore((s) => s.setActiveTemple);
  const me = useCurrentUser();
  // Admin Utama can open every temple; others see their own memberships.
  const mine = me?.isSuperAdmin
    ? temples.map((t) => ({ id: `all_${t.id}`, templeId: t.id, role: "superadmin" as const }))
    : memberships.filter((m) => m.userId === userId && m.status === "active");
  const router = useRouter();
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="press flex w-full items-center gap-3 rounded-2xl bg-white/10 p-3 text-left ring-1 ring-white/10 hover:bg-white/15"
        aria-label="Ganti pura"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-white/60">Ruang kerja pura</span>
          <span className="block truncate font-semibold text-white">{temple?.name ?? "—"}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 text-white/60" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Pilih pura" description="Setiap pura memiliki catatan keuangan yang terpisah." size="sm">
        <ul className="space-y-2 pb-2">
          {mine.map((m) => {
            const t = temples.find((x) => x.id === m.templeId);
            if (!t) return null;
            return (
              <li key={m.id}>
                <button
                  onClick={async () => {
                    setOpen(false);
                    onDone?.();
                    const r = await setActive(t.id);
                    if (!r.ok) return toast.error(r.error);
                    toast.success(`Beralih ke ${t.name}`);
                    router.push("/app");
                  }}
                  className={cn("press flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left", t.id === temple?.id ? "border-emerald-500 bg-mint/40" : "border-line hover:bg-ivory")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t.name} {t.status === "pending" && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Menunggu persetujuan</span>}</span>
                    <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold", ROLE_TONE[m.role])}>{ROLE_LABEL[m.role]}</span>
                  </span>
                  {t.id === temple?.id && <Check className="h-5 w-5 text-emerald-700" />}
                </button>
              </li>
            );
          })}
        </ul>
        <Link href="/onboarding" className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-sm font-semibold text-emerald-700 hover:bg-mint/40" onClick={() => setOpen(false)}>
          <Plus className="h-4 w-4" /> Daftarkan pura lain
        </Link>
      </Dialog>
    </>
  );
}

export function ProfileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser();
  const membership = useMembership();
  const role = useRole();
  const override = useStore((s) => s.session?.roleOverride);
  const setRoleOverride = useStore((s) => s.setRoleOverride);
  const resetData = useStore((s) => s.resetData);
  const isDemo = useIsDemo();
  const [confirmReset, setConfirmReset] = useState(false);
  const router = useRouter();
  if (!user) return null;
  return (
    <>
      <Dialog open={open} onClose={onClose} title="Profil & peran" size="sm">
        <div className="flex items-center gap-3 rounded-2xl bg-ivory p-3">
          <Avatar name={user.name} color={user.avatarColor} size={48} />
          <div className="min-w-0">
            <p className="truncate font-bold">{user.name}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
        </div>
        {!isDemo && role && (
          <p className="mt-4 text-sm text-muted">
            Peran Anda di pura ini: <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ROLE_TONE[role])}>{ROLE_LABEL[role]}</span>
          </p>
        )}
        {isDemo && <div className="mt-5">
          <p className="text-sm font-bold">Lihat aplikasi sebagai peran</p>
          <p className="text-sm text-muted">Simulasi hak akses untuk demo. Di versi produksi, peran ditentukan server.</p>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {ALL_ROLES.map((r) => {
              const isOwn = membership?.role === r;
              const active = role === r;
              return (
                <button
                  key={r}
                  onClick={() => {
                    setRoleOverride(isOwn ? undefined : r);
                    toast.success(`Melihat sebagai ${ROLE_LABEL[r]}`);
                  }}
                  className={cn("press flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left", active ? "border-emerald-500 bg-mint/40" : "border-line hover:bg-ivory")}
                >
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ROLE_TONE[r])}>{ROLE_LABEL[r]}</span>
                  <span className="text-xs text-muted">{isOwn ? "Peran Anda" : active ? "Dipratinjau" : ""}</span>
                </button>
              );
            })}
          </div>
          {override && <p className="mt-2 text-xs font-semibold text-gold-dark">Sedang mempratinjau peran lain.</p>}
        </div>}
        <div className="mt-5 space-y-2 border-t border-line pt-4">
          <Link href="/app/pengaturan?tab=profil-admin" onClick={onClose} className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold hover:bg-ivory">
            <UserCog className="h-5 w-5 text-muted" /> Profil saya
          </Link>
          {isDemo && <button onClick={() => setConfirmReset(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-semibold hover:bg-ivory">
            <RotateCcw className="h-5 w-5 text-muted" /> Atur ulang data demo
          </button>}
          <Link href="/keluar" onClick={onClose} className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold text-expense hover:bg-red-50">
            <LogOut className="h-5 w-5" /> {isDemo ? "Keluar dari mode demo" : "Keluar"}
          </Link>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        tone="danger"
        title="Atur ulang data demo?"
        description="Semua perubahan pada prototipe ini (transaksi, campaign, donasi) akan dikembalikan ke data contoh awal."
        confirmLabel="Ya, atur ulang"
        onConfirm={() => {
          resetData();
          setConfirmReset(false);
          onClose();
          toast.success("Data demo telah diatur ulang");
          router.push("/app");
        }}
      />
    </>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const isDemo = useIsDemo();
  const role = useRole();
  const unread = useUnread();
  const user = useCurrentUser();
  const temple = useActiveTemple();
  const [profile, setProfile] = useState(false);
  const groups: { key: "main" | "manage" | "system"; label: string }[] = [
    { key: "main", label: "Keuangan" },
    { key: "manage", label: "Kelola" },
    { key: "system", label: "Sistem" },
  ];
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col overflow-hidden bg-forest text-white lg:flex">
      <PatternBg />
      <div className="relative flex h-full flex-col p-4">
        <div className="flex items-center justify-between px-2 py-2">
          <Link href="/app"><Logo light /></Link>
        </div>
        <div className="mt-4"><TempleSwitcher /></div>
        <nav className="no-scrollbar mt-5 flex-1 space-y-5 overflow-y-auto" aria-label="Navigasi admin">
          {groups.map((g) => {
            const items = NAV.filter((n) => n.group === g.key && (!n.perm || can(role, n.perm)) && !(isDemo && n.hideInDemo));
            if (!items.length) return null;
            return (
              <div key={g.key}>
                <p className="px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">{g.label}</p>
                <ul className="mt-1.5 space-y-0.5">
                  {items.map((n) => {
                    const active = isActive(pathname, n.href);
                    return (
                      <li key={n.href}>
                        <Link
                          href={n.href}
                          className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors", active ? "text-forest" : "text-white/80 hover:bg-white/10 hover:text-white")}
                          aria-current={active ? "page" : undefined}
                        >
                          {active && <motion.span layoutId="side-active" className="absolute inset-0 rounded-xl bg-ivory" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
                          <n.icon className="relative h-5 w-5" aria-hidden />
                          <span className="relative">{n.label}</span>
                          {n.href === "/app/notifikasi" && unread > 0 && (
                            <span className="relative ml-auto rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-charcoal">{unread}</span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        {temple && (
          <Link href={`/pura/${temple.slug}`} target="_blank" className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white">
            <ExternalLink className="h-4 w-4" /> Lihat halaman publik
          </Link>
        )}
        {user && (
          <button onClick={() => setProfile(true)} className="press flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-left ring-1 ring-white/10 hover:bg-white/15">
            <Avatar name={user.name} color={user.avatarColor} size={38} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{user.name}</span>
              <span className="block truncate text-xs text-gold-light">{role ? ROLE_LABEL[role] : ""}</span>
            </span>
          </button>
        )}
      </div>
      <ProfileMenu open={profile} onClose={() => setProfile(false)} />
    </aside>
  );
}

function TopBar() {
  const temple = useActiveTemple();
  const user = useCurrentUser();
  const unread = useUnread();
  const [profile, setProfile] = useState(false);
  const { running } = useDemo();
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line/70 bg-ivory/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6 lg:px-8">
        <Link href="/app" className="lg:hidden" aria-label="Beranda"><Logo compact /></Link>
        <div className="min-w-0 flex-1 lg:hidden">
          <p className="truncate text-[15px] font-bold leading-tight text-forest">{temple?.name}</p>
          <p className="truncate text-xs text-muted">{temple?.regency}</p>
        </div>
        <div className="hidden flex-1 items-center gap-3 lg:flex">
          <PrototypeNotice />
        </div>
        {!running && <DemoButton variant="dark" className="hidden h-10 md:inline-flex" />}
        <Link href="/app/notifikasi" className="press relative grid h-11 w-11 place-items-center rounded-xl hover:bg-black/5" aria-label={`Notifikasi, ${unread} belum dibaca`}>
          <Bell className="h-6 w-6 text-charcoal" />
          {unread > 0 && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-expense px-1 text-[11px] font-bold text-white ring-2 ring-ivory">
              {unread}
            </motion.span>
          )}
        </Link>
        {user && (
          <button onClick={() => setProfile(true)} className="press rounded-full lg:hidden" aria-label="Profil & peran">
            <Avatar name={user.name} color={user.avatarColor} size={38} />
          </button>
        )}
      </div>
      <ProfileMenu open={profile} onClose={() => setProfile(false)} />
    </header>
  );
}

export function QuickActions({ open, onClose }: { open: boolean; onClose: () => void }) {
  const role = useRole();
  const router = useRouter();
  const actions = [
    { label: "Catat Pemasukan", desc: "Dana punia, sesari, sewa…", icon: ArrowDownLeft, href: "/app/transaksi/baru?type=income", tone: "bg-mint text-emerald-700", show: can(role, "tx.create") || can(role, "tx.draft") },
    { label: "Catat Pengeluaran", desc: "Banten, listrik, perbaikan…", icon: ArrowUpRight, href: "/app/transaksi/baru?type=expense", tone: "bg-orange-50 text-orange-700", show: can(role, "tx.create") || can(role, "tx.draft") },
    { label: "Pindah Dana", desc: "Setor kas ke bank, dll.", icon: ArrowLeftRight, href: "/app/transaksi/baru?type=transfer", tone: "bg-sky-50 text-sky-700", show: can(role, "tx.create") },
    { label: "Buat Campaign", desc: "Penggalangan dana baru", icon: Megaphone, href: "/app/campaign/baru", tone: "bg-gold-light text-gold-dark", show: can(role, "campaign.manage") },
    { label: "Buat Laporan", desc: "Unduh atau bagikan", icon: FileBarChart2, href: "/app/laporan", tone: "bg-violet-50 text-violet-700", show: can(role, "report.view") },
  ].filter((a) => a.show);
  return (
    <Dialog open={open} onClose={onClose} title="Mau mencatat apa?" size="sm">
      <div className="grid grid-cols-1 gap-2 pb-2">
        {actions.map((a) => (
          <button
            key={a.href}
            onClick={() => {
              onClose();
              router.push(a.href);
            }}
            className="press flex items-center gap-4 rounded-2xl border border-line bg-white p-4 text-left hover:border-emerald-300 hover:shadow-soft"
          >
            <span className={cn("grid h-12 w-12 place-items-center rounded-2xl", a.tone)}><a.icon className="h-6 w-6" /></span>
            <span>
              <span className="block text-[17px] font-bold">{a.label}</span>
              <span className="block text-sm text-muted">{a.desc}</span>
            </span>
          </button>
        ))}
        {!actions.length && <p className="text-muted">Peran Anda hanya dapat melihat data.</p>}
      </div>
    </Dialog>
  );
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const role = useRole();
  const unread = useUnread();
  const isDemo = useIsDemo();
  const items = NAV.filter((n) => !["/app", "/app/transaksi", "/app/campaign"].includes(n.href) && (!n.perm || can(role, n.perm)) && !(isDemo && n.hideInDemo));
  return (
    <Dialog open={open} onClose={onClose} title="Menu lainnya" size="sm">
      <div className="mb-3"><TempleSwitcherLight onDone={onClose} /></div>
      <div className="grid grid-cols-3 gap-2 pb-2">
        {items.map((n) => (
          <Link key={n.href} href={n.href} onClick={onClose} className="press relative flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-2 py-4 text-center text-sm font-semibold hover:bg-ivory">
            <n.icon className="h-6 w-6 text-emerald-700" />
            {n.label}
            {n.href === "/app/notifikasi" && unread > 0 && <span className="absolute right-2 top-2 rounded-full bg-expense px-1.5 text-[11px] font-bold text-white">{unread}</span>}
          </Link>
        ))}
        <Link href="/keluar" onClick={onClose} className="press flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-2 py-4 text-center text-sm font-semibold text-expense hover:bg-red-50">
          <LogOut className="h-6 w-6" /> Keluar
        </Link>
      </div>
      <div className="mt-3 flex justify-center"><DemoButton className="w-full" /></div>
    </Dialog>
  );
}

function TempleSwitcherLight({ onDone }: { onDone?: () => void }) {
  return (
    <div className="rounded-2xl bg-forest p-2">
      <TempleSwitcher onDone={onDone} />
    </div>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const [quick, setQuick] = useState(false);
  const [more, setMore] = useState(false);
  const role = useRole();
  const canCreate = can(role, "tx.create") || can(role, "tx.draft") || can(role, "campaign.manage");
  const item = (href: string, label: string, Icon: typeof Home) => {
    const active = isActive(pathname, href);
    return (
      <Link href={href} className={cn("flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold", active ? "text-emerald-700" : "text-muted")} aria-current={active ? "page" : undefined}>
        <span className={cn("grid h-8 w-14 place-items-center rounded-full transition-colors", active && "bg-mint")}>
          <Icon className="h-[22px] w-[22px]" />
        </span>
        {label}
      </Link>
    );
  };
  return (
    <>
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-xl lg:hidden" aria-label="Navigasi bawah">
        <div className="safe-bottom mx-auto flex max-w-lg items-end px-2">
          {item("/app", "Beranda", Home)}
          {item("/app/transaksi", "Transaksi", ReceiptText)}
          <div className="flex flex-1 justify-center">
            {canCreate ? (
              <button
                onClick={() => setQuick(true)}
                className="press -mt-6 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-forest text-white shadow-card ring-4 ring-white"
                aria-label="Catat transaksi baru"
              >
                <Plus className="h-8 w-8" />
              </button>
            ) : (
              item("/app/laporan", "Laporan", FileBarChart2)
            )}
          </div>
          {item("/app/campaign", "Campaign", Megaphone)}
          <button onClick={() => setMore(true)} className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold text-muted" aria-label="Menu lainnya">
            <span className="grid h-8 w-14 place-items-center rounded-full"><Menu className="h-[22px] w-[22px]" /></span>
            Lainnya
          </button>
        </div>
      </nav>
      <QuickActions open={quick} onClose={() => setQuick(false)} />
      <MoreSheet open={more} onClose={() => setMore(false)} />
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useStore((s) => s.hydrated);
  const session = useStore((s) => s.session);
  const temple = useActiveTemple();
  const mode = useStore((s) => s.mode);
  const exitDemo = useStore((s) => s.exitDemo);
  const demoTour = useDemo();

  useEffect(() => {
    if (!hydrated) return;
    if (!session) router.replace("/masuk");
    else if (!session.activeTempleId) router.replace("/onboarding");
  }, [hydrated, session, router]);

  if (pathname.startsWith("/app/presentasi")) return <>{children}</>;
  const isDemo = mode === "demo";

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="lg:pl-[272px]">
        {isDemo && !demoTour.running && (
          <div className="no-print flex items-center justify-center gap-3 bg-gold px-4 py-2 text-center text-sm font-semibold text-charcoal">
            <span>Mode demo — data contoh, tidak tersimpan ke server.</span>
            <button onClick={async () => { await exitDemo(); router.push("/masuk"); }} className="rounded-lg bg-charcoal px-3 py-1 text-xs font-bold text-white hover:bg-black">Keluar demo</button>
          </div>
        )}
        <TopBar />
          <motion.main
            key={pathname}
            id="konten"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mx-auto w-full max-w-6xl px-4 pb-32 pt-5 md:px-6 lg:px-8 lg:pb-12 lg:pt-8"
          >
            {hydrated && session && temple ? children : <ShellSkeleton />}
          </motion.main>
      </div>
      <BottomNav />
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Memuat">
      <div className="h-8 w-56 animate-pulse rounded-xl bg-stone-200" />
      <div className="h-48 animate-pulse rounded-3xl bg-stone-200" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-stone-200" />)}</div>
    </div>
  );
}
