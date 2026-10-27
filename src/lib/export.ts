"use client";
// Client-side exports: PDF (jsPDF), Excel (SheetJS) and CSV. Everything runs in the browser.
import { formatDate, formatDateTime, rupiah } from "./format";

export interface ReportTable {
  title: string;
  head: string[];
  body: (string | number)[][];
  /** Column indexes holding Rupiah numbers (formatted in PDF, kept numeric in Excel) */
  money?: number[];
  foot?: (string | number)[];
}

export interface ReportDoc {
  fileName: string;
  title: string;
  templeName: string;
  templeAddress?: string;
  period: string;
  summary: { label: string; value: number }[];
  tables: ReportTable[];
  signatory?: { name: string; role: string };
  footerNote?: string;
  note?: string;
}

function cell(v: string | number, money: boolean) {
  return money && typeof v === "number" ? rupiah(v) : String(v);
}

export async function buildPdf(doc: ReportDoc): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const M = 40;

  // Header band
  pdf.setFillColor(6, 78, 59);
  pdf.rect(0, 0, W, 92, "F");
  pdf.setFillColor(201, 168, 106);
  pdf.rect(0, 92, W, 3, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text(doc.title, M, 40);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10.5);
  pdf.text(doc.templeName + (doc.templeAddress ? ` · ${doc.templeAddress}` : ""), M, 58, { maxWidth: W - 2 * M });
  pdf.text(`Periode: ${doc.period}`, M, 75);

  let y = 120;
  // Summary tiles
  if (doc.summary.length) {
    const cols = Math.min(4, doc.summary.length);
    const gap = 10;
    const tw = (W - 2 * M - gap * (cols - 1)) / cols;
    doc.summary.forEach((s, i) => {
      const cx = M + (i % cols) * (tw + gap);
      const cy = y + Math.floor(i / cols) * 62;
      pdf.setFillColor(238, 250, 246);
      pdf.roundedRect(cx, cy, tw, 52, 6, 6, "F");
      pdf.setTextColor(95, 107, 122);
      pdf.setFontSize(8.5);
      pdf.text(s.label.toUpperCase(), cx + 10, cy + 18);
      pdf.setTextColor(23, 33, 43);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text(rupiah(s.value), cx + 10, cy + 38);
      pdf.setFont("helvetica", "normal");
    });
    y += Math.ceil(doc.summary.length / cols) * 62 + 12;
  }
  if (doc.note) {
    pdf.setFontSize(9.5);
    pdf.setTextColor(95, 107, 122);
    pdf.text(doc.note, M, y, { maxWidth: W - 2 * M });
    y += 20;
  }

  for (const t of doc.tables) {
    pdf.setTextColor(6, 78, 59);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    if (y > 740) {
      pdf.addPage();
      y = 50;
    }
    pdf.text(t.title, M, y);
    pdf.setFont("helvetica", "normal");
    const money = new Set(t.money ?? []);
    autoTable(pdf, {
      startY: y + 8,
      head: [t.head],
      body: t.body.map((r) => r.map((v, i) => cell(v, money.has(i)))),
      foot: t.foot ? [t.foot.map((v, i) => cell(v, money.has(i)))] : undefined,
      margin: { left: M, right: M },
      styles: { fontSize: 8.8, cellPadding: 5, textColor: [23, 33, 43], lineColor: [232, 228, 220], lineWidth: 0.5 },
      headStyles: { fillColor: [8, 127, 109], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [243, 234, 215], textColor: [23, 33, 43], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 249, 246] },
      columnStyles: Object.fromEntries(Array.from(money).map((i) => [i, { halign: "right" as const }])),
      didParseCell: (data) => {
        if (money.has(data.column.index)) data.cell.styles.halign = "right";
      },
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;
  }

  if (doc.signatory?.name) {
    if (y > 700) {
      pdf.addPage();
      y = 60;
    }
    pdf.setFontSize(10);
    pdf.setTextColor(23, 33, 43);
    pdf.text(`Dibuat pada ${formatDate(new Date())}`, W - M - 200, y);
    pdf.text(doc.signatory.role, W - M - 200, y + 16);
    pdf.setFont("helvetica", "bold");
    pdf.text(doc.signatory.name, W - M - 200, y + 72);
    pdf.setFont("helvetica", "normal");
  }

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(140, 140, 140);
    const foot = `${doc.footerNote ?? ""}  ·  Dibuat dengan PURA (prototipe, data fiktif) · ${formatDateTime(new Date())}  ·  Hal. ${i}/${pages}`;
    pdf.text(foot, W / 2, pdf.internal.pageSize.getHeight() - 20, { align: "center", maxWidth: W - 2 * M });
  }
  return pdf.output("blob");
}

export function downloadBlob(blob: Blob, fileName: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function exportPdf(doc: ReportDoc) {
  const blob = await buildPdf(doc);
  downloadBlob(blob, `${doc.fileName}.pdf`);
  return blob;
}

export async function exportXlsx(doc: ReportDoc) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const summary = [
    [doc.title],
    [doc.templeName],
    [`Periode: ${doc.period}`],
    [],
    ["Ringkasan", "Nominal (Rp)"],
    ...doc.summary.map((s) => [s.label, s.value]),
  ];
  const ws0 = XLSX.utils.aoa_to_sheet(summary);
  ws0["!cols"] = [{ wch: 36 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws0, "Ringkasan");
  const used = new Set<string>(["Ringkasan"]);
  for (const t of doc.tables) {
    let name = t.title.replace(/[\\/?*[\]:]/g, "").slice(0, 28) || "Data";
    while (used.has(name)) name = name.slice(0, 26) + Math.floor(Math.random() * 90 + 10);
    used.add(name);
    const rows = [t.head, ...t.body, ...(t.foot ? [t.foot] : [])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = t.head.map((h, i) => ({ wch: Math.max(h.length + 2, ...t.body.slice(0, 50).map((r) => String(r[i] ?? "").length + 2), 10) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, `${doc.fileName}.xlsx`);
}

function csvEscape(v: string | number) {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV of the most detailed table (or all tables, separated by a blank line). */
export function exportCsv(doc: ReportDoc) {
  const lines: string[] = [];
  lines.push(csvEscape(doc.title));
  lines.push(csvEscape(`${doc.templeName} - Periode: ${doc.period}`));
  lines.push("");
  for (const t of doc.tables) {
    lines.push(csvEscape(t.title));
    lines.push(t.head.map(csvEscape).join(","));
    t.body.forEach((r) => lines.push(r.map(csvEscape).join(",")));
    if (t.foot) lines.push(t.foot.map(csvEscape).join(","));
    lines.push("");
  }
  // BOM so Excel opens UTF-8 correctly
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${doc.fileName}.csv`);
}

/** Try to share the PDF file via the Web Share API (mobile). Returns false when unsupported. */
export async function sharePdfFile(doc: ReportDoc, text: string) {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  const blob = await buildPdf(doc);
  const file = new File([blob], `${doc.fileName}.pdf`, { type: "application/pdf" });
  if (!navigator.canShare({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title: doc.title, text });
    return true;
  } catch {
    return true; // user cancelled — still supported
  }
}
