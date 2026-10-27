"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { HandHeart, LayoutDashboard, LogIn, Menu, Smartphone, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonClass } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/format";

const links = [
  { href: "/pura", label: "Daftar Pura" },
  { href: "/donasi", label: "Penggalangan Dana" },
  { href: "/#cara-kerja", label: "Cara Berpunia" },
  { href: "/pasang", label: "Pasang di HP" },
];

export function PublicHeader({ transparent }: { transparent?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const hydrated = useStore((s) => s.hydrated);
  const me = useStore((s) => s.me);
  const isStaff = useStore((s) => s.access.isStaff);
  const loggedIn = hydrated && !!me;

  const accountButtons = (full?: boolean) =>
    loggedIn ? (
      <>
        <Link href="/umat" className={buttonClass(isStaff ? "outline" : "primary", full ? "lg" : "md", cn(full ? "w-full" : "h-10"))}>
          <HandHeart className="h-4 w-4" /> Punia Saya
        </Link>
        {isStaff && (
          <Link href="/app" className={buttonClass("primary", full ? "lg" : "md", cn(full ? "w-full" : "h-10"))}>
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
        )}
      </>
    ) : (
      <Link href="/masuk" className={buttonClass("primary", full ? "lg" : "md", cn(full ? "w-full" : "h-10"))}>
        <LogIn className="h-4 w-4" /> Masuk
      </Link>
    );

  return (
    <header className={cn("safe-top safe-x sticky top-0 z-40 border-b backdrop-blur-xl", transparent ? "border-transparent bg-ivory/70" : "border-line/70 bg-ivory/85")}>
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Beranda PURA">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={cn("rounded-lg px-3 py-2 text-[15px] font-semibold text-charcoal/80 hover:bg-black/5 hover:text-charcoal", pathname === l.href && "text-emerald-700")}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">{accountButtons()}</div>
        <button className="press grid h-11 w-11 place-items-center rounded-xl hover:bg-black/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu" aria-expanded={open}>
          <Menu className="h-6 w-6" />
        </button>
      </div>
      <MobileMenu open={open} onClose={() => setOpen(false)} pathname={pathname}>
        {accountButtons(true)}
      </MobileMenu>
    </header>
  );
}

/**
 * Full-screen phone menu. Rendered into <body> through a portal: the header has a blur effect
 * (backdrop-filter), and that makes any position:fixed child measure itself against the 64px
 * header instead of the screen — the panel ended up 64px tall with its links spilling, without a
 * background, over the page. Solid panel, a backdrop that blocks clicks, page scroll locked.
 */
function MobileMenu({ open, onClose, pathname, children }: { open: boolean; onClose: () => void; pathname: string; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div aria-hidden className="absolute inset-0 bg-charcoal/55" onClick={onClose} />
          <motion.div
            className="absolute inset-y-0 right-0 flex h-dvh w-[86%] max-w-sm flex-col overflow-y-auto bg-ivory px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] shadow-lift"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button ref={closeRef} className="press flex h-11 items-center gap-1.5 rounded-xl bg-white px-3 font-semibold shadow-soft ring-1 ring-line hover:bg-stone-50" onClick={onClose} aria-label="Tutup menu">
                <X className="h-5 w-5" /> Tutup
              </button>
            </div>
            <nav className="mt-6 flex flex-col gap-1" aria-label="Navigasi utama">
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={onClose} className={cn("flex items-center gap-2 rounded-xl px-4 py-3.5 text-lg font-semibold hover:bg-black/5", pathname === l.href && "bg-mint text-emerald-800")}>
                  {l.href === "/pasang" && <Smartphone className="h-5 w-5 text-emerald-700" />}
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto space-y-2.5 pt-6" onClick={onClose}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
