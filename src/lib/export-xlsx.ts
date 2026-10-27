"use client";
// Professional Excel workbook (ExcelJS, MIT): several sheets, kop, real numbers/dates, Rupiah
// format, SUM / running-balance formulas, borders, banded rows, frozen + repeated header row,
// print setup (A4/F4, orientation, fit to width, margins, page numbers) and signature block.
import type ExcelJSNS from "exceljs";
import { formatDateTime } from "./format";
import { isWide, type Paper, type ReportDoc, type ReportTable, type SignatureBlock } from "./export";

type Worksheet = ExcelJSNS.Worksheet;
type Cell = ExcelJSNS.Cell;

const C = {
  forest: "FF064E3B",
  emerald: "FF087F6D",
  gold: "FFC9A86A",
  goldLight: "FFF3EAD7",
  band: "FFF7F6F2",
  line: "FFD9D4C7",
  muted: "FF5F6B7A",
  ink: "FF17212B",
  white: "FFFFFFFF",
};
const RUPIAH = '"Rp"#,##0;[Red]-"Rp"#,##0;"Rp"0';
// [$-421] = Indonesian month names (Okt, Des) whatever the language of Excel itself.
const DATE = "[$-421]d mmm yyyy";
// Excel paper codes: 9 = A4, 14 = Folio 8½ × 13 in (≈ F4 21,5 × 33 cm)
const PAPER_CODE: Record<Paper, number> = { a4: 9, f4: 14 };
const thin = { style: "thin" as const, color: { argb: C.line } };
const box = { top: thin, left: thin, bottom: thin, right: thin };

const col = (n: number) => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};
const isoDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
// Dates as real Excel dates at noon UTC, so no time zone can move them to another day.
const toDate = (v: string) => new Date(`${v}T12:00:00Z`);

function sheetName(title: string, used: Set<string>) {
  // Excel allows 31 characters: cut at a word boundary so the tab never ends mid-word.
  let n = title.replace(/[\\/?*[\]:]/g, "").trim();
  if (n.length > 31) n = n.slice(0, 32).replace(/\s+\S*$/, "").replace(/[\s&—-]+$/, "");
  n = n || "Data";
  for (let i = 2; used.has(n); i++) n = `${n.slice(0, 28)} ${i}`;
  used.add(n);
  return n;
}

/** Kop on top of every sheet: title, temple, banjar, period, printing time. Returns next free row. */
function kop(ws: Worksheet, doc: ReportDoc, width: number, sheetTitle: string, printedAt: string) {
  const last = col(Math.max(width, 4));
  const lines: [string, Partial<ExcelJSNS.Font>][] = [
    [doc.title, { bold: true, size: 15, color: { argb: C.forest } }],
    [[doc.templeName, doc.templeAddress].filter(Boolean).join(" · "), { size: 11, color: { argb: C.ink } }],
    ...(doc.banjarNames ? ([[`Banjar pengempon: ${doc.banjarNames}`, { size: 10, color: { argb: C.muted } }]] as [string, Partial<ExcelJSNS.Font>][]) : []),
    [`Periode: ${doc.period}   ·   Dicetak: ${printedAt}`, { size: 10, color: { argb: C.muted } }],
    ...(doc.subtitle ? ([[doc.subtitle, { bold: true, size: 10, color: { argb: "FFB42318" } }]] as [string, Partial<ExcelJSNS.Font>][]) : []),
  ];
  lines.forEach(([text, font], i) => {
    const r = i + 1;
    ws.mergeCells(`A${r}:${last}${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = text;
    c.font = { name: "Calibri", ...font };
    c.alignment = { vertical: "middle" };
    ws.getRow(r).height = i === 0 ? 22 : 16;
  });
  const bar = lines.length + 1;
  for (let x = 1; x <= Math.max(width, 4); x++) ws.getCell(bar, x).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.gold } };
  ws.getRow(bar).height = 4;
  const titleRow = bar + 2;
  ws.getCell(titleRow, 1).value = sheetTitle;
  ws.getCell(titleRow, 1).font = { name: "Calibri", bold: true, size: 12, color: { argb: C.forest } };
  return titleRow + 1;
}

function styleHeader(row: ExcelJSNS.Row, width: number, moneyCols: Set<number>) {
  row.height = 20;
  for (let x = 1; x <= width; x++) {
    const c = row.getCell(x);
    c.font = { name: "Calibri", bold: true, color: { argb: C.white } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.emerald } };
    c.border = box;
    c.alignment = { vertical: "middle", horizontal: moneyCols.has(x - 1) ? "right" : "left", wrapText: true, indent: 1 };
  }
}

function styleBody(c: Cell, money: boolean, date: boolean, band: boolean) {
  c.font = { name: "Calibri", color: { argb: C.ink } };
  c.border = box;
  if (band) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.band } };
  if (money) {
    c.numFmt = RUPIAH;
    c.alignment = { horizontal: "right", vertical: "top", indent: 1 };
  } else if (date) {
    c.numFmt = DATE;
    c.alignment = { horizontal: "left", vertical: "top", indent: 1 };
  } else {
    c.alignment = { vertical: "top", wrapText: true, indent: 1 };
  }
}

/**
 * Writes one report table at `startRow`. Money totals become =SUM(...) formulas; a cash-book
 * table gets its running balance as =previous + income − expense. Returns the next free row.
 */
function writeTable(ws: Worksheet, t: ReportTable, startRow: number) {
  const width = t.head.length;
  const money = new Set(t.money ?? []);
  const dates = new Set(t.dateCols ?? []);
  const headRow = ws.getRow(startRow);
  t.head.forEach((h, i) => (headRow.getCell(i + 1).value = h));
  styleHeader(headRow, width, money);
  const first = startRow + 1;
  t.body.forEach((r, ri) => {
    const row = ws.getRow(first + ri);
    r.forEach((v, ci) => {
      const c = row.getCell(ci + 1);
      if (v === "" || v === null) c.value = null;
      else if (dates.has(ci) && isoDate(v)) c.value = toDate(v as string);
      else c.value = v;
      styleBody(c, money.has(ci), dates.has(ci), ri % 2 === 1);
    });
    if (t.ledger && ri > 0) {
      const L = t.ledger;
      const bal = row.getCell(L.balanceCol + 1);
      const prev = `${col(L.balanceCol + 1)}${first + ri - 1}`;
      bal.value = { formula: `${prev}+N(${col(L.incomeCol + 1)}${first + ri})-N(${col(L.expenseCol + 1)}${first + ri})`, result: r[L.balanceCol] as number };
    }
  });
  const last = first + t.body.length - 1;
  let next = last + 1;
  if (t.foot) {
    const row = ws.getRow(next);
    t.foot.forEach((v, ci) => {
      const c = row.getCell(ci + 1);
      const numeric = typeof v === "number";
      const sum = t.body.reduce((s, r) => s + (typeof r[ci] === "number" ? (r[ci] as number) : 0), 0);
      const L = t.ledger;
      if (L && ci === L.balanceCol && t.body.length) c.value = { formula: `${col(ci + 1)}${last}`, result: v as number };
      else if (numeric && t.body.length && (!L || ci !== L.balanceCol) && Math.abs(sum - (v as number)) < 0.5) c.value = { formula: `SUM(${col(ci + 1)}${first}:${col(ci + 1)}${last})`, result: v as number };
      else c.value = v === "" ? null : v;
      c.font = { name: "Calibri", bold: true, color: { argb: C.ink } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.goldLight } };
      c.border = { ...box, top: { style: "medium", color: { argb: C.gold } } };
      if (money.has(ci)) c.numFmt = RUPIAH;
      c.alignment = { horizontal: money.has(ci) || numeric ? "right" : "left", indent: 1 };
    });
    next++;
  }
  return { headRow: startRow, next };
}

/** Column widths from the longest shown value (dates/money measured as printed), within limits. */
function autoWidth(ws: Worksheet, tables: ReportTable[]) {
  const widths: number[] = [];
  for (const t of tables) {
    t.head.forEach((h, i) => {
      const values = [h, ...t.body.map((r) => r[i]), ...(t.foot ? [t.foot[i]] : [])];
      const len = Math.max(
        ...values.map((v) => (typeof v === "number" ? `Rp${Math.round(v).toLocaleString("id-ID")}`.length + 4 : t.dateCols?.includes(i) && isoDate(v) ? 11 : String(v ?? "").length))
      );
      widths[i] = Math.max(widths[i] ?? 0, Math.min(len + 2, i === 2 && t.ledger ? 48 : 40), 9);
    });
  }
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  // A narrow table (2 columns) would clip the kop, which spans at least 4 columns: give the
  // empty columns next to the table enough width for the kop text.
  const kopCols = Math.max(widths.length, 4);
  const total = widths.reduce((a, b) => a + b, 0);
  if (widths.length < kopCols && total < 80) {
    for (let i = widths.length + 1; i <= kopCols; i++) ws.getColumn(i).width = Math.ceil((80 - total) / (kopCols - widths.length));
  }
}

/** Signature block (place & date, "Mengetahui," then signers). Kept together on one page. */
function writeSignatures(ws: Worksheet, sig: SignatureBlock, startRow: number, width: number) {
  const cols = [
    ...(sig.acknowledger ? [{ ...sig.acknowledger, lead: "Mengetahui," }] : []),
    ...sig.signers.map((s) => ({ ...s, lead: "" })),
  ];
  if (!cols.length) return startRow;
  const span = Math.max(width, cols.length);
  const per = Math.max(1, Math.floor(span / cols.length));
  const r0 = startRow + 1;
  // Each signer needs room for a full name: widen the slot's last column when it is too narrow.
  for (let i = 0; i < cols.length; i++) {
    const ids = Array.from({ length: per }, (_, k) => 1 + i * per + k);
    const w = ids.reduce((a, n) => a + (ws.getColumn(n).width ?? 9), 0);
    if (w < 24) ws.getColumn(ids[ids.length - 1]).width = (ws.getColumn(ids[ids.length - 1]).width ?? 9) + 24 - w;
  }
  ws.mergeCells(r0, Math.max(1, span - per * 2 + 1), r0, span);
  const place = ws.getCell(r0, Math.max(1, span - per * 2 + 1));
  place.value = `${sig.place ? `${sig.place}, ` : ""}${sig.date}`;
  place.alignment = { horizontal: "right" };
  place.font = { name: "Calibri" };
  cols.forEach((c, i) => {
    const from = 1 + i * per;
    const to = from + per - 1;
    const put = (row: number, value: string, font: Partial<ExcelJSNS.Font> = {}) => {
      ws.mergeCells(row, from, row, to);
      const cell = ws.getCell(row, from);
      cell.value = value;
      cell.alignment = { horizontal: "center", vertical: "bottom", wrapText: true };
      cell.font = { name: "Calibri", ...font };
    };
    put(r0 + 2, c.lead);
    put(r0 + 3, c.role);
    // Name bold and underlined, as on a printed Indonesian report; dotted line when not filled in.
    put(r0 + 7, c.name ?? "(..............................)", c.name ? { bold: true, underline: true } : {});
  });
  for (let r = r0 + 4; r <= r0 + 6; r++) ws.getRow(r).height = 20; // room to sign
  return r0 + 8;
}

/** Signature block height in points (rows written by writeSignatures). */
const SIGN_BLOCK_PT = 5 * 15 + 3 * 20 + 15;

/**
 * Excel cannot "keep rows together", so estimate where printed pages end: each row's height
 * (wrapped text counted line by line), scaled by fit-to-width, against the printable height of
 * the chosen paper. If the signature block would straddle a page end, start it on a new page.
 */
function keepSignaturesTogether(ws: Worksheet, blockStartRow: number, paper: Paper, landscape: boolean) {
  const inch = 72;
  const [pw, ph] = paper === "a4" ? [8.27, 11.69] : [8.5, 13];
  const printableW = ((landscape ? ph : pw) - 1.0) * inch;
  const printableH = ((landscape ? pw : ph) - 1.3) * inch;
  const widthsPt: number[] = [];
  ws.columns.forEach((c, i) => (widthsPt[i] = (c.width ?? 9) * 5.6));
  const sheetW = widthsPt.reduce((a, b) => a + b, 0);
  const scale = Math.min(1, printableW / Math.max(sheetW, 1));
  const pageH = printableH / scale; // in sheet points
  let used = 0;
  for (let r = 1; r < blockStartRow; r++) {
    const row = ws.getRow(r);
    let h = row.height ?? 15;
    if (!row.height) {
      row.eachCell((cell, n) => {
        if (cell.alignment?.wrapText && typeof cell.value === "string") {
          const chars = Math.max(4, (ws.getColumn(n).width ?? 9) - 1);
          h = Math.max(h, 15 * Math.ceil(cell.value.length / chars));
        }
      });
    }
    used = used + h > pageH ? h : used + h;
  }
  if (used + SIGN_BLOCK_PT > pageH) ws.getRow(blockStartRow - 1).addPageBreak();
}

function printSetup(ws: Worksheet, doc: ReportDoc, paper: Paper, landscape: boolean, headRow?: number) {
  ws.pageSetup = {
    paperSize: PAPER_CODE[paper] as ExcelJSNS.PaperSize,
    orientation: landscape ? "landscape" : "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.7, header: 0.3, footer: 0.3 },
    ...(headRow ? { printTitlesRow: `${headRow}:${headRow}` } : {}),
  };
  ws.headerFooter = {
    oddFooter: `&L&8${doc.templeName.replace(/&/g, "&&")} · ${doc.period}&R&8Hal. &P dari &N`,
    evenFooter: `&L&8${doc.templeName.replace(/&/g, "&&")} · ${doc.period}&R&8Hal. &P dari &N`,
  };
  if (headRow) ws.views = [{ state: "frozen", ySplit: headRow, xSplit: 0, showGridLines: false }];
  else ws.views = [{ showGridLines: false }];
}

export async function buildXlsx(doc: ReportDoc, opts: { paper?: Paper } = {}): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const paper = opts.paper ?? "a4";
  const printedAt = formatDateTime(new Date());
  const wb = new ExcelJS.Workbook();
  wb.creator = "PURA";
  wb.created = new Date();
  wb.title = doc.title;
  const used = new Set<string>();
  const ledger = doc.tables.find((t) => t.ledger);
  const categories = doc.tables.filter((t) => /per kategori/i.test(t.title));
  const others = doc.tables.filter((t) => t !== ledger && !categories.includes(t));

  // 1) Ringkasan: totals + signature block (one page, so the block is never cut).
  const sum = wb.addWorksheet(sheetName("Ringkasan", used), { properties: { tabColor: { argb: C.emerald } } });
  let r = kop(sum, doc, 4, "Ringkasan", printedAt);
  if (doc.summary.length) {
    const res = writeTable(sum, { title: "Ringkasan", head: ["Uraian", "Nominal"], body: doc.summary.map((s) => [s.label, s.value]), money: [1] }, r);
    r = res.next + 1;
  }
  if (doc.note) {
    sum.mergeCells(r, 1, r, 4);
    const c = sum.getCell(r, 1);
    c.value = doc.note;
    c.alignment = { wrapText: true, vertical: "top" };
    c.font = { name: "Calibri", italic: true, color: { argb: C.muted } };
    sum.getRow(r).height = Math.min(90, 15 * Math.ceil(doc.note.length / 90));
    r += 2;
  }
  // Four equal columns: the totals use A–B, the signature block spreads over A–D.
  for (let i = 1; i <= 4; i++) sum.getColumn(i).width = 26;
  if (doc.signatures) writeSignatures(sum, doc.signatures, r, 4);
  printSetup(sum, doc, paper, false);

  // 2) Rincian Transaksi (cash book with running-balance formulas) or the main detail table.
  const main = ledger ?? others.shift();
  if (main) {
    const ws = wb.addWorksheet(sheetName(ledger ? "Rincian Transaksi" : main.title, used));
    const start = kop(ws, doc, main.head.length, main.title, printedAt);
    const res = writeTable(ws, main, start);
    autoWidth(ws, [main]);
    const landscape = main.head.length >= 7 || isWide({ ...doc, tables: [main] });
    if (doc.signatures) {
      keepSignaturesTogether(ws, res.next + 1, paper, landscape);
      writeSignatures(ws, doc.signatures, res.next + 1, main.head.length);
    }
    printSetup(ws, doc, paper, landscape, res.headRow);
  }

  // 3) Per Kategori (income and expense summaries stacked on one sheet).
  if (categories.length) {
    const ws = wb.addWorksheet(sheetName("Per Kategori", used));
    let row = kop(ws, doc, 2, "Ringkasan per kategori", printedAt) - 1;
    for (const t of categories) {
      ws.getCell(row, 1).value = t.title;
      ws.getCell(row, 1).font = { name: "Calibri", bold: true, size: 11, color: { argb: C.forest } };
      row = writeTable(ws, t, row + 1).next + 2;
    }
    autoWidth(ws, categories);
    printSetup(ws, doc, paper, false);
  }

  // 4) Any other tables, one sheet each.
  for (const t of others) {
    const ws = wb.addWorksheet(sheetName(t.title, used));
    const res = writeTable(ws, t, kop(ws, doc, t.head.length, t.title, printedAt));
    autoWidth(ws, [t]);
    printSetup(ws, doc, paper, t.head.length >= 7, res.headRow);
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
