"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonClass } from "@/components/ui/button";
import { PrototypeNotice } from "@/components/shared/prototype-banner";
import { DemoButton } from "@/components/demo/demo-tour";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/format";

const links = [
  { href: "/pura", label: "Direktori Pura" },
  { href: "/donasi", label: "Penggalangan Dana" },
  { href: "/#cara-kerja", label: "Cara Kerja" },
  { href: "/#untuk-pengurus", label: "Untuk Pengurus" },
];

export function PublicHeader({ transparent }: { transparent?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const loggedIn = useStore((s) => s.hydrated && !!s.session);
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-xl",
        transparent ? "border-transparent bg-ivory/70" : "border-line/70 bg-ivory/85"
      )}
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Beranda PURA">
            <Logo />
          </Link>
          <span className="hidden sm:inline-flex">
            <PrototypeNotice />
          </span>
        </div>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-lg px-3 py-2 text-[15px] font-semibold text-charcoal/80 hover:bg-black/5 hover:text-charcoal",
                pathname === l.href && "text-emerald-700"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <DemoButton variant="dark" className="h-10" />
          {loggedIn ? (
            <Link href="/app" className={buttonClass("primary", "md", "h-10")}>
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
          ) : (
            <>
              <Link href="/masuk" className={buttonClass("ghost", "md", "h-10")}>
                Masuk
              </Link>
              <Link href="/daftar" className={buttonClass("primary", "md", "h-10")}>
                Daftarkan Pura
              </Link>
            </>
          )}
        </div>
        <button
          className="press grid h-11 w-11 place-items-center rounded-xl hover:bg-black/5 lg:hidden"
          onClick={() => setOpen(true)}
          aria-label="Buka menu"
          aria-expanded={open}
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-charcoal/40" onClick={() => setOpen(false)} />
            <motion.div
              className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col bg-ivory p-5 shadow-lift"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              role="dialog"
              aria-label="Menu"
            >
              <div className="flex items-center justify-between">
                <Logo />
                <button className="press grid h-11 w-11 place-items-center rounded-xl hover:bg-black/5" onClick={() => setOpen(false)} aria-label="Tutup menu">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <nav className="mt-6 flex flex-col gap-1" aria-label="Navigasi utama">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3.5 text-lg font-semibold hover:bg-black/5">
                    {l.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto space-y-2.5">
                <PrototypeNotice />
                <DemoButton variant="dark" className="h-12 w-full" />
                {loggedIn ? (
                  <Link href="/app" className={buttonClass("primary", "lg", "w-full")}>
                    Buka Dashboard
                  </Link>
                ) : (
                  <>
                    <Link href="/daftar" className={buttonClass("primary", "lg", "w-full")}>
                      Daftarkan Pura
                    </Link>
                    <Link href="/masuk" className={buttonClass("outline", "lg", "w-full")}>
                      Masuk Pengurus
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
