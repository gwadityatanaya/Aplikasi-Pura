import type { PublishedReport, Temple } from "./types";
import { formatDate, slugify } from "./format";
import type { ReportDoc } from "./export";
import { templeLocation } from "./temple";

export function snapshotDoc(r: PublishedReport, t: Temple): ReportDoc {
  const s = r.snapshot;
  return {
    fileName: slugify(`${t.name} ${r.title}`),
    title: r.title,
    templeName: t.name,
    templeAddress: [templeLocation(t), t.province].filter(Boolean).join(", "),
    period: `${formatDate(r.periodStart)} – ${formatDate(r.periodEnd)}`,
    summary: [
      { label: "Saldo awal", value: s.openingBalance },
      { label: "Total pemasukan", value: s.income },
      { label: "Total pengeluaran", value: s.expense },
      { label: "Saldo akhir", value: s.closingBalance },
    ],
    note: s.note,
    tables: [
      {
        title: "Pemasukan per kategori",
        head: ["Kategori", "Nominal"],
        body: s.incomeByCategory.map((c) => [c.name, c.amount]),
        foot: ["Total", s.income],
        money: [1],
      },
      {
        title: "Pengeluaran per kategori",
        head: ["Kategori", "Nominal"],
        body: s.expenseByCategory.map((c) => [c.name, c.amount]),
        foot: ["Total", s.expense],
        money: [1],
      },
    ],
    footerNote: t.branding.footerNote,
  };
}
