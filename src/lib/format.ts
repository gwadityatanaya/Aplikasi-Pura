import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const numberFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Rp17.250.000 */
export function rupiah(value: number, opts: { sign?: boolean } = {}) {
  const abs = Math.abs(Math.round(value));
  const s = `Rp${numberFmt.format(abs)}`;
  if (value < 0) return `-${s}`;
  if (opts.sign && value > 0) return `+${s}`;
  return s;
}

/** Rp17,2 jt — for chart axes and tight spaces */
export function rupiahShort(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}Rp${trim(abs / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${sign}Rp${trim(abs / 1_000_000)} jt`;
  if (abs >= 1_000) return `${sign}Rp${trim(abs / 1_000)} rb`;
  return `${sign}Rp${abs}`;
}

function trim(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(n);
}

export function formatNumber(value: number) {
  return numberFmt.format(value);
}

/** Parse "1.250.000" or "Rp 1.250.000" into 1250000 */
export function parseRupiah(input: string): number {
  const digits = input.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function toDate(d: string | Date) {
  if (d instanceof Date) return d;
  // Treat plain YYYY-MM-DD as local date to avoid timezone shifts.
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day);
  }
  return new Date(d);
}

/** 27 Oktober 2026 */
export function formatDate(d: string | Date) {
  return toDate(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** 27 Okt 2026 */
export function formatDateShort(d: string | Date) {
  return toDate(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/** Selasa, 27 Oktober 2026 */
export function formatDateLong(d: string | Date) {
  return toDate(d).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function formatDateTime(d: string | Date) {
  const date = toDate(d);
  return `${formatDateShort(date)}, ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
}

export function formatMonth(d: string | Date) {
  return toDate(d).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export function monthShort(monthIndex: number) {
  return new Date(2026, monthIndex, 1).toLocaleDateString("id-ID", { month: "short" });
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} jam lalu`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} hari lalu`;
  return formatDateShort(iso);
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysBetween(a: string, b: string) {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
}

export function uid(prefix = "id") {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 1 || /[A-Z]/.test(w))
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.min(100, (value / total) * 100);
}

export function formatPercent(p: number) {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(p)}%`;
}

/** "I Made Suarjana (contoh)" → "Suarjana": the last word, ignoring anything in brackets. */
export function callNameOf(name: string) {
  const parts = name.replace(/\([^)]*\)/g, " ").trim().split(/\s+/).filter(Boolean);
  return (parts[parts.length - 1] ?? name).slice(0, 60);
}
