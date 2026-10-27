"use client";
// Client-side exports: PDF (jsPDF), Excel (SheetJS) and CSV. Everything runs in the browser.
import { formatDate, formatDateShort, formatDateTime, rupiah } from "./format";

export interface ReportTable {
  title: string;
  head: string[];
  body: (string | number)[][];
  /** Column indexes holding Rupiah numbers (formatted in PDF, kept numeric in Excel) */
  money?: number[];
  /** Column indexes holding ISO dates "2026-10-27" (shown as 27 Okt 2026, real dates in Excel) */
  dateCols?: number[];
  foot?: (string | number)[];
  /**
   * Cash-book table: first body row is the opening balance, the balance column is a running
   * total. Lets the Excel export write it as formulas (=previous + income − expense).
   */
  ledger?: { opening: number; incomeCol: number; expenseCol: number; balanceCol: number };
}

/** One signature: jabatan + name. No name → a dotted line to fill in by hand. */
export interface Signer {
  role: string;
  name?: string;
}
export interface SignatureBlock {
  /** e.g. "Mengwi" — printed as "Mengwi, 27 Oktober 2026" */
  place: string;
  date: string;
  signers: Signer[];
  /** "Mengetahui," — e.g. Kelian Banjar / Pengurus Banjar */
  acknowledger?: Signer;
}
export type Paper = "a4" | "f4";

export interface ReportDoc {
  fileName: string;
  title: string;
  templeName: string;
  templeAddress?: string;
  banjarNames?: string;
  /** Shown in red under the title, e.g. "VERSI LENGKAP — INTERNAL" */
  subtitle?: string;
  period: string;
  summary: { label: string; value: number }[];
  tables: ReportTable[];
  signatures?: SignatureBlock;
  footerNote?: string;
  note?: string;
}

function cell(v: string | number, money: boolean, date = false) {
  if (date && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDateShort(v);
  return money && typeof v === "number" ? rupiah(v) : String(v);
}

/** How a table cell is shown on screen / in PDF (Rupiah, dates). */
export function displayCell(t: ReportTable, v: string | number, col: number) {
  return cell(v, !!t.money?.includes(col), !!t.dateCols?.includes(col));
}

/** Paper sizes in points (1 pt = 1/72 inch). F4 / Folio = 215 × 330 mm. */
const PAPER: Record<Paper, [number, number]> = { a4: [595.28, 841.89], f4: [609.45, 935.43] };
export const PAPER_LABEL: Record<Paper, string> = { a4: "A4 (21 × 29,7 cm)", f4: "F4 / Folio (21,5 × 33 cm)" };

/** Wide tables (7+ columns) are printed in landscape so nothing gets squeezed. */
export const isWide = (doc: ReportDoc) => doc.tables.some((t) => t.head.length >= 7);

export async function buildPdf(doc: ReportDoc, opts: { paper?: Paper } = {}): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const landscape = isWide(doc);
  const pdf = new jsPDF({ unit: "pt", format: PAPER[opts.paper ?? "a4"], orientation: landscape ? "landscape" : "portrait" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 40;
  const BOTTOM = H - 40; // keep clear of the page-number footer
  const printedAt = formatDateTime(new Date());

  // Kop: title, temple, banjar, period, printing date
  const kopH = doc.subtitle ? 112 : 100;
  pdf.setFillColor(6, 78, 59);
  pdf.rect(0, 0, W, kopH, "F");
  pdf.setFillColor(201, 168, 106);
  pdf.rect(0, kopH, W, 3, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(doc.title, M, 34, { maxWidth: W - 2 * M });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(doc.templeName + (doc.templeAddress ? ` · ${doc.templeAddress}` : ""), M, 52, { maxWidth: W - 2 * M });
  if (doc.banjarNames) pdf.text(`Banjar pengempon: ${doc.banjarNames}`, M, 66, { maxWidth: W - 2 * M });
  pdf.text(`Periode: ${doc.period}   ·   Dicetak: ${printedAt}`, M, 80, { maxWidth: W - 2 * M });
  if (doc.subtitle) {
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 214, 214);
    pdf.text(doc.subtitle, M, 96);
    pdf.setFont("helvetica", "normal");
  }

  let y = kopH + 26;
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
    const lines = pdf.splitTextToSize(doc.note, W - 2 * M);
    pdf.text(lines, M, y);
    y += lines.length * 12 + 10;
  }

  for (const t of doc.tables) {
    // Short tables (e.g. per kategori, posisi kas) are kept whole on one page.
    const estimate = 30 + (t.body.length + (t.foot ? 2 : 1)) * 18;
    if (y > BOTTOM - 80 || (t.body.length <= 15 && y + estimate > BOTTOM)) {
      pdf.addPage();
      y = 50;
    }
    pdf.setTextColor(6, 78, 59);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(t.title, M, y);
    pdf.setFont("helvetica", "normal");
    const money = new Set(t.money ?? []);
    autoTable(pdf, {
      startY: y + 8,
      head: [t.head],
      body: t.body.map((r) => r.map((v, i) => cell(v, money.has(i), !!t.dateCols?.includes(i)))),
      foot: t.foot ? [t.foot.map((v, i) => cell(v, money.has(i)))] : undefined,
      showHead: "everyPage",
      showFoot: "lastPage",
      margin: { left: M, right: M, top: 40, bottom: 48 },
      styles: { fontSize: 8.6, cellPadding: 4.5, textColor: [23, 33, 43], lineColor: [232, 228, 220], lineWidth: 0.5, overflow: "linebreak" },
      headStyles: { fillColor: [8, 127, 109], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [243, 234, 215], textColor: [23, 33, 43], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 249, 246] },
      didParseCell: (data) => {
        if (money.has(data.column.index)) data.cell.styles.halign = "right";
        if (money.has(data.column.index) && data.section !== "head") data.cell.styles.cellWidth = "wrap";
      },
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;
  }

  if (doc.signatures) y = drawSignatures(pdf, doc.signatures, y, W, M, BOTTOM);

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(140, 140, 140);
    const foot = [doc.footerNote, `${doc.templeName} · ${doc.period} · dicetak ${printedAt}`].filter(Boolean).join("  ·  ");
    pdf.text(foot, M, H - 20, { maxWidth: W - 2 * M - 80 });
    pdf.text(`Hal. ${i} dari ${pages}`, W - M, H - 20, { align: "right" });
  }
  return pdf.output("blob");
}

const SIGN_SPACE = 58; // room for the handwritten signature

/**
 * "Mengwi, 27 Oktober 2026" on the right, then one column per signer (and "Mengetahui," first
 * when given): jabatan, space to sign, a line, and the name under it (or dots to fill in by hand).
 * The whole block always stays on one page.
 */
function drawSignatures(pdf: import("jspdf").jsPDF, sig: SignatureBlock, y: number, W: number, M: number, bottom: number) {
  const cols: (Signer & { lead?: string })[] = [
    ...(sig.acknowledger ? [{ ...sig.acknowledger, lead: "Mengetahui," }] : []),
    ...sig.signers.map((s, i) => ({ ...s, lead: i === 0 && sig.acknowledger ? "" : undefined })),
  ];
  if (!cols.length) return y;
  const blockH = 30 + 16 + 14 + SIGN_SPACE + 30;
  if (y + blockH > bottom) {
    pdf.addPage();
    y = 60;
  }
  pdf.setTextColor(23, 33, 43);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`${sig.place ? `${sig.place}, ` : ""}${sig.date}`, W - M, y, { align: "right" });
  y += 30;
  const colW = (W - 2 * M) / cols.length;
  cols.forEach((c, i) => {
    const cx = M + colW * i + colW / 2;
    if (c.lead) pdf.text(c.lead, cx, y, { align: "center" });
    pdf.text(c.role, cx, y + 14, { align: "center", maxWidth: colW - 12 });
    const lineY = y + 14 + SIGN_SPACE;
    pdf.setDrawColor(120, 120, 120);
    pdf.setLineWidth(0.6);
    pdf.line(cx - Math.min(80, colW / 2 - 10), lineY, cx + Math.min(80, colW / 2 - 10), lineY);
    if (c.name) {
      pdf.setFont("helvetica", "bold");
      pdf.text(c.name, cx, lineY + 14, { align: "center", maxWidth: colW - 12 });
      pdf.setFont("helvetica", "normal");
    } else {
      pdf.text("(.................................................)", cx, lineY + 14, { align: "center" });
    }
  });
  return y + 14 + SIGN_SPACE + 30;
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

export async function exportPdf(doc: ReportDoc, opts: { paper?: Paper } = {}) {
  const blob = await buildPdf(doc, opts);
  downloadBlob(blob, `${doc.fileName}.pdf`);
  return blob;
}

export async function exportXlsx(doc: ReportDoc, opts: { paper?: Paper } = {}) {
  const { buildXlsx } = await import("./export-xlsx");
  downloadBlob(await buildXlsx(doc, opts), `${doc.fileName}.xlsx`);
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
