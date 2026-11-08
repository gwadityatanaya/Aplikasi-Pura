import { formatDate, formatDateTime, rupiah } from "./format";
import { PURPOSE_LABEL } from "./permissions";
import { downloadBlob } from "./export";

/** What /api/umat/punia/[id] returns: one punia, for its own sender only. */
export interface PuniaProof {
  id: string;
  /** Short code of the submission (shown before a record number exists) */
  code: string;
  templeName: string;
  templeSlug?: string;
  amount: number;
  transferDate: string;
  sentAt: string;
  status: "pending" | "verified" | "rejected" | "corrected";
  /** Number of the cash-book record, once verified */
  number?: string;
  verifiedAt?: string;
  rejectedReason?: string;
  purpose: string;
  channel: string;
  campaign?: string;
  activity?: string;
  /** Account label + bank + last 4 digits only, or "Tunai (kas pura)" */
  into?: string;
  referenceNo?: string;
  anonymous: boolean;
  donorName: string;
}

export const PROOF_NOT_RECEIPT =
  "Ini konfirmasi PENCATATAN di aplikasi PURA, BUKAN kuitansi bank dan bukan bukti transaksi bank. Bukti pembayaran yang sah adalah catatan di m-banking atau rekening Anda sendiri.";

export const PROOF_STATUS: Record<PuniaProof["status"], { label: string; desc: string }> = {
  pending: { label: "Menunggu verifikasi", desc: "Pengurus pura belum mencocokkan punia ini dengan rekening pura." },
  verified: { label: "Disahkan", desc: "Pengurus pura sudah mencocokkan dan mencatat punia ini di buku kas pura." },
  rejected: { label: "Ditolak", desc: "Punia ini belum bisa disahkan. Lihat alasannya di Punia Saya, perbaiki, lalu kirim ulang." },
  corrected: { label: "Dibatalkan (dikoreksi)", desc: "Catatan ini dibatalkan pengurus dengan entri koreksi, sehingga tidak dihitung." },
};

/**
 * The rows printed on the page and in the PDF. The donor's name appears only when the owner asks
 * for it (an anonymous punia hides it by default, so a shared PDF does not reveal it).
 */
export function proofRows(p: PuniaProof, showName: boolean): [string, string][] {
  const rows: [string, string][] = [
    ["Pura", p.templeName],
    ["Nominal", rupiah(p.amount)],
    ["Tanggal transfer", formatDate(p.transferDate)],
    ["Status", PROOF_STATUS[p.status].label],
    ["Nomor catatan", p.number ?? (p.status === "pending" ? "Belum ada (menunggu verifikasi)" : "—")],
  ];
  if (p.verifiedAt) rows.push(["Tanggal pengesahan", formatDate(p.verifiedAt.slice(0, 10))]);
  rows.push(["Kode kiriman", p.code], ["Tujuan", PURPOSE_LABEL[p.purpose as keyof typeof PURPOSE_LABEL] ?? p.purpose]);
  if (p.campaign) rows.push(["Penggalangan dana", p.campaign]);
  if (p.activity) rows.push(["Kegiatan", p.activity]);
  if (p.into) rows.push(["Masuk ke", p.into]);
  if (p.referenceNo) rows.push(["No. referensi", p.referenceNo]);
  rows.push(["Nama donatur", p.anonymous ? (showName ? `${p.donorName} (anonim di laporan pura)` : "Anonim") : p.donorName]);
  rows.push(["Dikirim", formatDateTime(p.sentAt)]);
  return rows;
}

export async function downloadProofPdf(p: PuniaProof, showName: boolean) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a5" });
  const W = pdf.internal.pageSize.getWidth();
  const M = 32;
  pdf.setFillColor(6, 78, 59);
  pdf.rect(0, 0, W, 70, "F");
  pdf.setFillColor(201, 168, 106);
  pdf.rect(0, 70, W, 3, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text("Bukti pencatatan punia", M, 32);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.text(p.templeName, M, 50, { maxWidth: W - 2 * M });

  let y = 98;
  // The notice comes first and stands out: this is not a bank receipt.
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  const notice = pdf.splitTextToSize(PROOF_NOT_RECEIPT, W - 2 * M - 20);
  const nh = notice.length * 12 + 16;
  pdf.setFillColor(254, 243, 199);
  pdf.roundedRect(M, y - 4, W - 2 * M, nh, 6, 6, "F");
  pdf.setTextColor(124, 74, 3);
  pdf.text(notice, M + 10, y + 10);
  y += nh + 18;

  const labelW = 110;
  for (const [k, v] of proofRows(p, showName)) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(95, 107, 122);
    pdf.text(k, M, y);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(k === "Nominal" ? 13 : 10.5);
    pdf.setTextColor(23, 33, 43);
    const lines = pdf.splitTextToSize(v, W - 2 * M - labelW);
    pdf.text(lines, M + labelW, y);
    y += Math.max(1, lines.length) * 14 + 6;
  }
  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(95, 107, 122);
  pdf.text(pdf.splitTextToSize(PROOF_STATUS[p.status].desc, W - 2 * M), M, y);
  pdf.text(`Dicetak dari aplikasi PURA: ${formatDateTime(new Date())}`, M, pdf.internal.pageSize.getHeight() - 24);
  downloadBlob(pdf.output("blob"), `bukti-punia-${p.number ?? p.code}.pdf`.replace(/[^\w.-]+/g, "-"));
}
