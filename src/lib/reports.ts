import type { ReportDoc, ReportTable } from "./export";
import type { DataState, Temple, Transaction } from "./types";
import { activitySummary, byCategory, campaignStats, expenseOf, incomeOf, monthlyCashflow, summarize } from "./ledger";
import { formatDate, formatDateShort, slugify } from "./format";
import { PURPOSE_LABEL } from "./permissions";
import { templeLocation } from "./temple";

export type ReportType = "summary" | "income" | "expense" | "cashflow" | "activity" | "campaign" | "punia" | "punia_lengkap" | "detail";

export const REPORT_TYPES: { value: ReportType; label: string; desc: string }[] = [
  { value: "summary", label: "Ringkasan keuangan", desc: "Saldo awal, pemasukan, pengeluaran, saldo akhir" },
  { value: "income", label: "Laporan pemasukan", desc: "Rincian semua pemasukan" },
  { value: "expense", label: "Laporan pengeluaran", desc: "Rincian semua pengeluaran" },
  { value: "cashflow", label: "Arus kas bulanan", desc: "Saldo awal & akhir setiap bulan" },
  { value: "activity", label: "Laporan per kegiatan", desc: "Pemasukan & pengeluaran tiap kegiatan" },
  { value: "campaign", label: "Pertanggungjawaban campaign", desc: "Dana terkumpul dan penggunaannya" },
  { value: "punia", label: "Laporan punia — versi umum / paruman", desc: "Punia disahkan per tujuan & kegiatan; donatur anonim tertulis \"Anonim\"" },
  { value: "punia_lengkap", label: "Laporan punia — versi lengkap (internal)", desc: "Dengan nama asli & pencatat. Hanya untuk pengurus, jangan dibagikan" },
  { value: "detail", label: "Rincian transaksi", desc: "Daftar lengkap seluruh transaksi" },
];

export interface ReportFilters {
  type: ReportType;
  from: string;
  to: string;
  txType: "" | "income" | "expense" | "transfer";
  categoryId: string;
  activityId: string;
  campaignId: string;
  accountId: string;
  status: "confirmed" | "all" | "draft";
}

type WS = {
  data: DataState;
  templeId: string;
  temple?: Temple;
  transactions: Transaction[];
};

const signed = (t: Transaction) => (t.reversalOf ? -t.amount : t.amount);

export function filterTx(ws: WS, f: ReportFilters) {
  return ws.transactions
    .filter((t) => {
      if (t.date < f.from || t.date > f.to) return false;
      if (f.status === "confirmed" && t.status !== "confirmed") return false;
      if (f.status === "draft" && t.status !== "draft") return false;
      if (f.txType && t.type !== f.txType) return false;
      if (f.categoryId && t.categoryId !== f.categoryId) return false;
      if (f.activityId && t.activityId !== f.activityId) return false;
      if (f.campaignId && t.campaignId !== f.campaignId) return false;
      if (f.accountId && t.accountId !== f.accountId && t.toAccountId !== f.accountId) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
}

export function buildReport(ws: WS, f: ReportFilters): ReportDoc {
  const { data } = ws;
  const temple = ws.temple!;
  const cats = data.categories;
  const catName = (id?: string) => cats.find((c) => c.id === id)?.name ?? "—";
  const accName = (id?: string) => data.accounts.find((a) => a.id === id)?.name ?? "—";
  const actName = (id?: string) => data.activities.find((a) => a.id === id)?.name ?? "—";
  const rows = filterTx(ws, f);
  const s = summarize(data, ws.templeId, { from: f.from, to: f.to, accountId: f.accountId || undefined });
  const income = incomeOf(rows);
  const expense = expenseOf(rows);
  const typeLabel = REPORT_TYPES.find((r) => r.value === f.type)!.label;
  const period = `${formatDate(f.from)} – ${formatDate(f.to)}`;
  const base = {
    fileName: `${slugify(`${typeLabel} ${temple.name}`)}_${f.from}_${f.to}`,
    title: typeLabel === "Ringkasan keuangan" ? temple.branding.headerTitle : `${typeLabel}`,
    templeName: temple.name,
    templeAddress: [templeLocation(temple), temple.province].filter(Boolean).join(", "),
    period,
    signatory: { name: temple.branding.signatoryName, role: temple.branding.signatoryRole },
    footerNote: temple.branding.footerNote,
    note: f.status !== "confirmed" ? "Catatan: laporan ini menyertakan transaksi berstatus draf yang belum dikonfirmasi." : undefined,
  };
  const txTable = (title: string, list: Transaction[], kind?: "income" | "expense"): ReportTable => ({
    title,
    head: kind ? ["Tanggal", "No.", "Keterangan", "Kategori", "Kegiatan", "Nominal"] : ["Tanggal", "No.", "Keterangan", "Jenis", "Kategori", "Kas/Rekening", "Status", "Nominal"],
    body: list.map((t) =>
      kind
        ? [formatDateShort(t.date), t.number, t.description, catName(t.categoryId), t.activityId ? actName(t.activityId) : "—", signed(t)]
        : [
            formatDateShort(t.date),
            t.number,
            t.description,
            t.type === "income" ? "Pemasukan" : t.type === "expense" ? "Pengeluaran" : "Pindah dana",
            t.type === "transfer" ? "—" : catName(t.categoryId),
            t.type === "transfer" ? `${accName(t.accountId)} → ${accName(t.toAccountId)}` : accName(t.accountId),
            t.status === "draft" ? "Draf" : t.reversalOf ? "Koreksi" : t.reversedBy ? "Dikoreksi" : "Terkonfirmasi",
            t.type === "expense" ? -signed(t) : signed(t),
          ]
    ),
    foot: kind ? ["", "", "Total", "", "", kind === "income" ? income : expense] : undefined,
    money: kind ? [5] : [7],
  });
  const catTable = (title: string, kind: "income" | "expense"): ReportTable => {
    const r = byCategory(rows, cats, kind);
    return { title, head: ["Kategori", "Nominal"], body: r.map((x) => [x.name, x.amount]), foot: ["Total", kind === "income" ? income : expense], money: [1] };
  };

  switch (f.type) {
    case "summary":
      return {
        ...base,
        summary: [
          { label: "Saldo awal", value: s.openingBalance },
          { label: "Total pemasukan", value: income },
          { label: "Total pengeluaran", value: expense },
          { label: "Saldo akhir", value: s.closingBalance },
        ],
        tables: [
          catTable("Pemasukan per kategori", "income"),
          catTable("Pengeluaran per kategori", "expense"),
          {
            title: "Posisi kas & rekening akhir periode",
            head: ["Kas / Rekening", "Saldo"],
            body: data.accounts.filter((a) => a.templeId === ws.templeId).map((a) => [a.name + (a.bankName ? ` (${a.bankName})` : ""), summarize(data, ws.templeId, { to: f.to, accountId: a.id }).closingBalance]),
            foot: ["Total", s.closingBalance],
            money: [1],
          },
        ],
      };
    case "income": {
      const list = rows.filter((t) => t.type === "income");
      return { ...base, summary: [{ label: "Total pemasukan", value: income }, { label: "Jumlah transaksi", value: list.length }].slice(0, 1), tables: [catTable("Ringkasan per kategori", "income"), txTable("Rincian pemasukan", list, "income")] };
    }
    case "expense": {
      const list = rows.filter((t) => t.type === "expense");
      return { ...base, summary: [{ label: "Total pengeluaran", value: expense }], tables: [catTable("Ringkasan per kategori", "expense"), txTable("Rincian pengeluaran", list, "expense")] };
    }
    case "cashflow": {
      const m = monthlyCashflow(data, ws.templeId, f.from, f.to);
      return {
        ...base,
        summary: [
          { label: "Saldo awal", value: s.openingBalance },
          { label: "Total masuk", value: s.income },
          { label: "Total keluar", value: s.expense },
          { label: "Saldo akhir", value: s.closingBalance },
        ],
        tables: [{ title: "Arus kas per bulan", head: ["Bulan", "Saldo awal", "Masuk", "Keluar", "Saldo akhir"], body: m.map((r) => [r.month, r.opening, r.income, r.expense, r.closing]), money: [1, 2, 3, 4] }],
      };
    }
    case "activity": {
      const acts = data.activities.filter((a) => a.templeId === ws.templeId && (!f.activityId || a.id === f.activityId));
      const body = acts.map((a) => {
        const r = activitySummary(a, rows);
        return [a.name, a.fundType === "restricted" ? "Dana khusus" : "Dana umum", a.budget, r.income, r.expense, r.net];
      });
      const general = rows.filter((t) => !t.activityId);
      body.push(["Tanpa kegiatan", "Dana umum", 0, incomeOf(general), expenseOf(general), incomeOf(general) - expenseOf(general)]);
      return {
        ...base,
        summary: [{ label: "Total pemasukan", value: income }, { label: "Total pengeluaran", value: expense }, { label: "Selisih", value: income - expense }],
        tables: [{ title: "Ringkasan per kegiatan", head: ["Kegiatan", "Jenis dana", "Anggaran", "Masuk", "Keluar", "Sisa"], body, foot: ["Total", "", "", income, expense, income - expense], money: [2, 3, 4, 5] }],
        note: (base.note ? base.note + " " : "") + "Kegiatan adalah pengelompokan laporan; semua transaksi berasal dari satu buku kas pura sehingga tidak ada dana yang dihitung ganda.",
      };
    }
    case "campaign": {
      const cps = data.campaigns.filter((c) => c.templeId === ws.templeId && c.status !== "draft" && (!f.campaignId || c.id === f.campaignId));
      const donations = data.donations;
      const body = cps.map((c) => {
        const st = campaignStats(c, donations);
        const used = data.transactions.filter((t) => t.campaignId === c.id && t.type === "expense" && t.status === "confirmed").reduce((x, t) => x + signed(t), 0);
        return [c.title, c.target, st.collected, st.contributors, used, st.collected - used];
      });
      const tables: ReportTable[] = [{ title: "Ringkasan campaign", head: ["Campaign", "Target", "Terkumpul", "Donatur", "Digunakan", "Sisa"], body, money: [1, 2, 4, 5] }];
      for (const c of cps) {
        const exp = data.transactions.filter((t) => t.campaignId === c.id && t.type === "expense" && t.status === "confirmed");
        if (exp.length) tables.push({ title: `Penggunaan dana: ${c.title}`, head: ["Tanggal", "No.", "Keterangan", "Nominal"], body: exp.map((t) => [formatDateShort(t.date), t.number, t.description, signed(t)]), money: [3] });
      }
      const tot = body.reduce((x, r) => x + (r[2] as number), 0);
      const used = body.reduce((x, r) => x + (r[4] as number), 0);
      return { ...base, period: `Sampai ${formatDate(f.to)}`, summary: [{ label: "Total terkumpul", value: tot }, { label: "Telah digunakan", value: used }, { label: "Sisa dana campaign", value: tot - used }], tables, note: "Hanya donasi terverifikasi yang dihitung. Data pribadi donatur tidak dicantumkan." };
    }
    case "punia":
    case "punia_lengkap": {
      // Versi umum is safe to share at paruman: ANONIM donors are "Anonim" and the pengurus who typed
      // an entry is not named. Versi lengkap is for pengurus / Pengurus Banjar / Admin Utama only.
      const full = f.type === "punia_lengkap";
      const list = data.donations
        .filter((d) => d.templeId === ws.templeId && d.status === "verified" && !d.correctedAt)
        .filter((d) => { const day = d.transferDate ?? d.date; return day >= f.from && day <= f.to; })
        .filter((d) => !f.campaignId || d.campaignId === f.campaignId)
        .sort((a, b) => (a.transferDate ?? a.date).localeCompare(b.transferDate ?? b.date));
      const total = list.reduce((x, d) => x + d.amount, 0);
      const campName = (id?: string) => data.campaigns.find((c) => c.id === id)?.title ?? "—";
      const purposes = (Object.keys(PURPOSE_LABEL) as (keyof typeof PURPOSE_LABEL)[])
        .map((k) => { const g = list.filter((d) => (d.purpose ?? "umum") === k); return [PURPOSE_LABEL[k], g.length, g.reduce((x, d) => x + d.amount, 0)] as (string | number)[]; })
        .filter((r) => (r[1] as number) > 0);
      const camps = Array.from(new Set(list.map((d) => d.campaignId).filter(Boolean))) as string[];
      const channel = { transfer: "Transfer", tunai: "Tunai", whatsapp: "WhatsApp", simulasi: "Simulasi" } as const;
      const tables: ReportTable[] = [{ title: "Per tujuan punia", head: ["Tujuan", "Jumlah", "Nominal"], body: purposes, foot: ["Total", list.length, total], money: [2] }];
      if (camps.length) {
        tables.push({
          title: "Per kegiatan / odalan",
          head: ["Kegiatan", "Jumlah", "Nominal"],
          body: camps.map((id) => { const g = list.filter((d) => d.campaignId === id); return [campName(id), g.length, g.reduce((x, d) => x + d.amount, 0)]; }),
          money: [2],
        });
      }
      tables.push(
        full
          ? {
              title: `Rincian punia (${list.length}) — INTERNAL`,
              head: ["Tgl transfer", "Nama donatur", "Tampil di publik", "Tujuan", "Lewat", "Dicatat oleh", "Nominal"],
              body: list.map((d) => [formatDateShort(d.transferDate ?? d.date), d.donorName, d.privacy === "public" ? "Tampil" : "Anonim", PURPOSE_LABEL[d.purpose ?? "umum"], channel[d.channel], d.inputByName ?? "Umat (aplikasi)", d.amount]),
              foot: ["", "", "", "", "", "Total", total],
              money: [6],
            }
          : {
              title: `Rincian punia (${list.length})`,
              head: ["Tgl transfer", "Nama", "Tujuan", "Kegiatan", "Lewat", "Nominal"],
              body: list.map((d) => [formatDateShort(d.transferDate ?? d.date), d.privacy === "public" ? d.donorName : "Anonim", PURPOSE_LABEL[d.purpose ?? "umum"], campName(d.campaignId), channel[d.channel], d.amount]),
              foot: ["", "", "", "", "Total", total],
              money: [5],
            }
      );
      return {
        ...base,
        summary: [{ label: "Total punia disahkan", value: total }, { label: "Jumlah punia", value: list.length }].slice(0, 1),
        tables,
        note: full
          ? "VERSI LENGKAP — RAHASIA. Berisi nama asli donatur yang memilih ANONIM. Hanya untuk pengurus pura, Pengurus Banjar, dan Admin Utama. Jangan dibagikan di grup atau paruman."
          : "Hanya punia yang sudah disahkan pengurus. Umat yang memilih ANONIM dicantumkan sebagai \"Anonim\".",
      };
    }
    case "detail":
    default:
      return {
        ...base,
        summary: [{ label: "Total pemasukan", value: income }, { label: "Total pengeluaran", value: expense }, { label: "Selisih", value: income - expense }],
        tables: [txTable(`Rincian transaksi (${rows.length})`, rows)],
      };
  }
}

/** Concise WhatsApp-ready summary text. */
export function whatsappSummary(ws: WS, f: ReportFilters) {
  const { data } = ws;
  const s = summarize(data, ws.templeId, { from: f.from, to: f.to });
  const rows = filterTx(ws, { ...f, status: "confirmed" });
  const topExp = byCategory(rows, data.categories, "expense").slice(0, 3);
  const fmt = (n: number) => "Rp" + n.toLocaleString("id-ID");
  const lines = [
    `*Laporan Keuangan ${ws.temple?.name}*`,
    `Periode: ${formatDate(f.from)} – ${formatDate(f.to)}`,
    "",
    `Saldo awal: ${fmt(s.openingBalance)}`,
    `Pemasukan: ${fmt(s.income)}`,
    `Pengeluaran: ${fmt(s.expense)}`,
    `*Saldo akhir: ${fmt(s.closingBalance)}*`,
  ];
  if (topExp.length) {
    lines.push("", "Pengeluaran terbesar:");
    topExp.forEach((c) => lines.push(`• ${c.name}: ${fmt(c.amount)}`));
  }
  lines.push("", "Laporan lengkap (PDF) dibagikan terpisah oleh prajuru. Suksma 🙏");
  return lines.join("\n");
}
