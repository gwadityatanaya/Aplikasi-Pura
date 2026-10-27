"use client";
import { EmergencyBar } from "@/components/app/emergency-bar";
import { templeLocation } from "@/lib/temple";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Archive, ArrowDownLeft, ArrowUpRight, Bell, Check, ChevronsUpDown, ExternalLink, FileBarChart2, HandCoins, HandHeart, Home, LogOut, Menu, Plus, ReceiptText, UserCog } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PatternBg } from "@/components/brand/ornament";
import { Dialog } from "@/components/ui/dialog";
import { useAccess, useActiveTemple, useCurrentUser, useRole, useStore } from "@/lib/store";
import { ROLE_LABEL, ROLE_TONE, can } from "@/lib/permissions";
import { cn, initials } from "@/lib/format";
import { NAV, isActive, type NavItem } from "./nav";
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

/** Pending punia of the active temple — shown as a badge. */
export function usePendingPunia() {
  // Across every temple this person looks after, not only the one currently open.
  return useStore((s) => s.data.temples.reduce((n, t) => n + (t.pendingCount ?? 0), 0));
}

/** Notification preferences decide what is shown (the server keeps every notification). */
export function notificationVisible(kind: string, p: { donationPending: boolean; campaignTarget: boolean; campaignEnding: boolean; approvals: boolean; reportReady: boolean }) {
  const map: Record<string, boolean> = { donation_pending: p.donationPending, target_reached: p.campaignTarget, campaign_ending: p.campaignEnding, tx_approval: p.approvals, report_ready: p.reportReady };
  return map[kind] ?? true;
}

function useVisibleNav() {
  const role = useRole();
  const access = useAccess();
  const adminOnly = (p?: string) => p === "admin.manage" || p === "log.view";
  return (n: NavItem) =>
    (!n.perm || can(role, n.perm) || (access.isSuperAdmin && adminOnly(n.perm))) && (!n.banjarOnly || access.isSuperAdmin || access.banjarIds.length > 0);
}

/** Lets staff switch between temples they may open. */
function TempleSwitcher({ onDone, light }: { onDone?: () => void; light?: boolean }) {
  const [open, setOpen] = useState(false);
  const temple = useActiveTemple();
  const temples = useStore((s) => s.data.temples);
  const banjars = useStore((s) => s.data.banjars);
  const setActive = useStore((s) => s.setActiveTemple);
  const router = useRouter();
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn("press flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1", light ? "bg-white ring-line hover:bg-ivory" : "bg-white/10 ring-white/10 hover:bg-white/15")}
        aria-label="Ganti pura"
      >
        <span className="min-w-0 flex-1">
          <span className={cn("block text-xs", light ? "text-muted" : "text-white/60")}>Pura yang dibuka</span>
          <span className={cn("block truncate font-semibold", light ? "text-charcoal" : "text-white")}>{temple?.name ?? "—"}</span>
        </span>
        <ChevronsUpDown className={cn("h-4 w-4", light ? "text-muted" : "text-white/60")} />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Pilih pura" description="Setiap pura memiliki catatan keuangan yang terpisah." size="sm">
        <ul className="space-y-2 pb-2">
          {temples.map((t) => (
            <li key={t.id}>
              <button
                onClick={async () => {
                  setOpen(false);
                  onDone?.();
                  const r = await setActive(t.id);
                  if (!r.ok) return toast.error(r.error);
                  toast.success(`Membuka ${t.name}`);
                  router.push("/app");
                }}
                className={cn("press flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left", t.id === temple?.id ? "border-emerald-500 bg-mint/40" : "border-line hover:bg-ivory")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.name}</span>
                  <span className="block text-sm text-muted">{banjars.filter((b) => t.banjarIds?.includes(b.id)).map((b) => b.name).join(", ") || "—"}</span>
                  {t.pengurusCount === 0 && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Pengurus pura belum terdaftar</span>}
                </span>
                {t.id === temple?.id && <Check className="h-5 w-5 text-emerald-700" />}
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

export function ProfileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser();
  const role = useRole();
  if (!user) return null;
  return (
    <Dialog open={open} onClose={onClose} title="Akun saya" size="sm">
      <div className="flex items-center gap-3 rounded-2xl bg-ivory p-3">
        <Avatar name={user.name} color={user.avatarColor} size={48} />
        <div className="min-w-0">
          <p className="truncate font-bold">{user.name}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
      </div>
      {role && (
        <p className="mt-4 text-sm text-muted">
          Peran Anda di pura ini: <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ROLE_TONE[role])}>{ROLE_LABEL[role]}</span>
        </p>
      )}
      <div className="mt-5 space-y-2 border-t border-line pt-4">
        <Link href="/umat" onClick={onClose} className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold hover:bg-ivory">
          <HandHeart className="h-5 w-5 text-muted" /> Tampilan Umat (punia saya)
        </Link>
        <Link href="/app/pengaturan?tab=profil-admin" onClick={onClose} className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold hover:bg-ivory">
          <UserCog className="h-5 w-5 text-muted" /> Profil saya
        </Link>
        <Link href="/keluar" onClick={onClose} className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold text-expense hover:bg-red-50">
          <LogOut className="h-5 w-5" /> Keluar
        </Link>
      </div>
    </Dialog>
  );
}

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return <span className="relative ml-auto rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-charcoal">{n}</span>;
}

function Sidebar() {
  const pathname = usePathname();
  const visible = useVisibleNav();
  const unread = useUnread();
  const pending = usePendingPunia();
  const user = useCurrentUser();
  const role = useRole();
  const temple = useActiveTemple();
  const [profile, setProfile] = useState(false);
  const groups: { key: NavItem["group"]; label: string }[] = [
    { key: "main", label: "Keuangan" },
    { key: "manage", label: "Kelola" },
    { key: "system", label: "Admin Utama" },
  ];
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col overflow-hidden bg-forest text-white lg:flex">
      <PatternBg />
      <div className="relative flex h-full flex-col p-4">
        <div className="px-2 py-2"><Link href="/app"><Logo light /></Link></div>
        {temple && <div className="mt-4"><TempleSwitcher /></div>}
        <nav className="no-scrollbar mt-5 flex-1 space-y-5 overflow-y-auto" aria-label="Navigasi dashboard">
          {groups.map((g) => {
            const items = NAV.filter((n) => n.group === g.key && visible(n));
            if (!items.length) return null;
            return (
              <div key={g.key}>
                <p className="px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">{g.label}</p>
                <ul className="mt-1.5 space-y-0.5">
                  {items.map((n) => {
                    const active = isActive(pathname, n.href);
                    return (
                      <li key={n.href}>
                        <Link href={n.href} className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors", active ? "text-forest" : "text-white/80 hover:bg-white/10 hover:text-white")} aria-current={active ? "page" : undefined}>
                          {active && <motion.span layoutId="side-active" className="absolute inset-0 rounded-xl bg-ivory" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
                          <n.icon className="relative h-5 w-5" aria-hidden />
                          <span className="relative">{n.label}</span>
                          {n.href === "/app/notifikasi" && <Badge n={unread} />}
                          {n.href === "/app/punia" && <Badge n={pending} />}
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
            <ExternalLink className="h-4 w-4" /> Lihat halaman umat
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
  return (
    <header className="no-print safe-top safe-x sticky top-0 z-30 border-b border-line/70 bg-ivory/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6 lg:px-8">
        <Link href="/app" className="lg:hidden" aria-label="Beranda"><Logo compact /></Link>
        <div className="min-w-0 flex-1 lg:hidden">
          <p className="truncate text-[15px] font-bold leading-tight text-forest">{temple?.name ?? "Dashboard"}</p>
          <p className="truncate text-xs text-muted">{temple ? templeLocation(temple) : ""}</p>
        </div>
        <div className="hidden flex-1 lg:block" />
        <Link href="/umat" className="press inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold hover:bg-ivory" title="Beralih ke Tampilan Umat">
          <HandHeart className="h-4 w-4 text-emerald-700" /> <span className="hidden sm:inline">Tampilan Umat</span>
        </Link>
        <Link href="/app/notifikasi" className="press relative grid h-11 w-11 place-items-center rounded-xl hover:bg-black/5" aria-label={`Notifikasi, ${unread} belum dibaca`}>
          <Bell className="h-6 w-6 text-charcoal" />
          {unread > 0 && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-expense px-1 text-[11px] font-bold text-white ring-2 ring-ivory">
              {unread}
            </motion.span>
          )}
        </Link>
        {user && (
          <button onClick={() => setProfile(true)} className="press rounded-full lg:hidden" aria-label="Akun saya">
            <Avatar name={user.name} color={user.avatarColor} size={38} />
          </button>
        )}
      </div>
      <ProfileMenu open={profile} onClose={() => setProfile(false)} />
    </header>
  );
}

/** An archived temple: everything stays readable (reports too), nothing can be changed. */
function ArchivedBar({ reason }: { reason?: string }) {
  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-2xl bg-charcoal p-4 text-white">
      <Archive className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
      <div className="text-[15px]">
        <p className="font-bold">Pura ini diarsipkan — hanya bisa dilihat</p>
        <p className="text-white/80">Tidak tampil di publik dan tidak menerima punia atau transaksi baru. Data dan laporan tetap bisa dibuka.{reason ? ` Alasan: ${reason}` : ""}</p>
      </div>
    </div>
  );
}

export function QuickActions({ open, onClose }: { open: boolean; onClose: () => void }) {
  const archived = useActiveTemple()?.status === "archived";
  const role = useRole();
  const router = useRouter();
  const actions = [
    { label: "Verifikasi Punia", desc: "Cocokkan dengan mutasi rekening", icon: HandCoins, href: "/app/punia", tone: "bg-gold-light text-gold-dark", show: can(role, "donation.manage") },
    { label: "Input Punia Manual", desc: "Tunai atau lewat WhatsApp", icon: ArrowDownLeft, href: "/app/punia?input=1", tone: "bg-mint text-emerald-700", show: can(role, "donation.manage") },
    { label: "Catat Pengeluaran", desc: "Banten, listrik, perbaikan…", icon: ArrowUpRight, href: "/app/transaksi/baru?type=expense", tone: "bg-orange-50 text-orange-700", show: can(role, "tx.create") },
    { label: "Catat Pemasukan Lain", desc: "Sesari, sewa, bunga bank…", icon: ReceiptText, href: "/app/transaksi/baru?type=income", tone: "bg-sky-50 text-sky-700", show: can(role, "tx.create") },
    { label: "Buat Laporan", desc: "PDF / Excel untuk paruman", icon: FileBarChart2, href: "/app/laporan", tone: "bg-violet-50 text-violet-700", show: can(role, "report.view") },
  ].filter((a) => a.show && (!archived || a.href === "/app/laporan"));
  return (
    <Dialog open={open} onClose={onClose} title="Mau melakukan apa?" size="sm">
      <div className="grid grid-cols-1 gap-2 pb-2">
        {actions.map((a) => (
          <button key={a.href} onClick={() => { onClose(); router.push(a.href); }} className="press flex items-center gap-4 rounded-2xl border border-line bg-white p-4 text-left hover:border-emerald-300 hover:shadow-soft">
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
  const visible = useVisibleNav();
  const unread = useUnread();
  const temple = useActiveTemple();
  const items = NAV.filter((n) => !["/app", "/app/punia", "/app/transaksi"].includes(n.href) && visible(n));
  return (
    <Dialog open={open} onClose={onClose} title="Menu lainnya" size="sm">
      {temple && <div className="mb-3"><TempleSwitcher onDone={onClose} light /></div>}
      <div className="grid grid-cols-3 gap-2 pb-2">
        {items.map((n) => (
          <Link key={n.href} href={n.href} onClick={onClose} className="press relative flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-2 py-4 text-center text-sm font-semibold hover:bg-ivory">
            <n.icon className="h-6 w-6 text-emerald-700" />
            {n.label}
            {n.href === "/app/notifikasi" && unread > 0 && <span className="absolute right-2 top-2 rounded-full bg-expense px-1.5 text-[11px] font-bold text-white">{unread}</span>}
          </Link>
        ))}
        <Link href="/umat" onClick={onClose} className="press flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-2 py-4 text-center text-sm font-semibold hover:bg-ivory">
          <HandHeart className="h-6 w-6 text-emerald-700" /> Tampilan Umat
        </Link>
        <Link href="/keluar" onClick={onClose} className="press flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-2 py-4 text-center text-sm font-semibold text-expense hover:bg-red-50">
          <LogOut className="h-6 w-6" /> Keluar
        </Link>
      </div>
    </Dialog>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const [quick, setQuick] = useState(false);
  const [more, setMore] = useState(false);
  const role = useRole();
  const pending = usePendingPunia();
  const canAct = can(role, "donation.manage") || can(role, "tx.create");
  const item = (href: string, label: string, Icon: typeof Home, badge = 0) => {
    const active = isActive(pathname, href);
    return (
      <Link href={href} className={cn("relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold", active ? "text-emerald-700" : "text-muted")} aria-current={active ? "page" : undefined}>
        <span className={cn("grid h-8 w-14 place-items-center rounded-full transition-colors", active && "bg-mint")}>
          <Icon className="h-[22px] w-[22px]" />
        </span>
        {label}
        {badge > 0 && <span className="absolute right-2 top-1 rounded-full bg-expense px-1.5 text-[11px] font-bold text-white">{badge}</span>}
      </Link>
    );
  };
  return (
    <>
      <nav className="no-print safe-x fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-xl lg:hidden" aria-label="Navigasi bawah">
        <div className="safe-bottom mx-auto flex max-w-lg items-end px-2">
          {item("/app", "Beranda", Home)}
          {item("/app/punia", "Punia", HandCoins, pending)}
          <div className="flex flex-1 justify-center">
            {canAct ? (
              <button onClick={() => setQuick(true)} className="press -mt-6 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-forest text-white shadow-card ring-4 ring-white" aria-label="Tindakan cepat">
                <Plus className="h-8 w-8" />
              </button>
            ) : (
              item("/app/laporan", "Laporan", FileBarChart2)
            )}
          </div>
          {item("/app/transaksi", "Kas", ReceiptText)}
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

/** Pages that work without an active temple (e.g. Back Office before any temple exists). */
const NO_TEMPLE_OK = ["/app/admin", "/app/log-aktivitas", "/app/banjar"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useStore((s) => s.hydrated);
  const session = useStore((s) => s.session);
  const access = useAccess();
  const temple = useActiveTemple();
  const allowWithoutTemple = NO_TEMPLE_OK.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!hydrated) return;
    if (!session) router.replace(`/masuk?next=${encodeURIComponent(pathname)}`);
    else if (!access.isStaff) router.replace("/umat"); // Umat have no dashboard
    else if (!session.activeTempleId && !allowWithoutTemple) router.replace(access.isSuperAdmin ? "/app/admin" : "/umat");
  }, [hydrated, session, access, router, pathname, allowWithoutTemple]);

  if (pathname.startsWith("/app/presentasi")) return <>{children}</>;
  const ready = hydrated && session && access.isStaff && (temple || allowWithoutTemple);

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="lg:pl-[272px]">
        <TopBar />
        <motion.main key={pathname} id="konten" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }} className="mx-auto w-full max-w-6xl pb-[calc(8rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 md:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {ready ? <>{temple?.status === "archived" ? <ArchivedBar reason={temple.archiveReason} /> : temple && <EmergencyBar />}{children}</> : <ShellSkeleton />}
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
