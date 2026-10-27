// Pusat bantuan — shared between the screens and the server.

export type HelpCategory = "cara_pakai" | "masalah" | "usul" | "penyalahgunaan" | "lainnya";
export type HelpStatus = "baru" | "diproses" | "selesai";

export const HELP_CATEGORIES: { value: HelpCategory; label: string }[] = [
  { value: "cara_pakai", label: "Tanya cara pakai" },
  { value: "masalah", label: "Laporkan masalah/bug" },
  { value: "usul", label: "Usul fitur" },
  { value: "penyalahgunaan", label: "Laporkan penyalahgunaan atau pura mencurigakan" },
  { value: "lainnya", label: "Lainnya" },
];
export const HELP_CATEGORY_LABEL = Object.fromEntries(HELP_CATEGORIES.map((c) => [c.value, c.label])) as Record<HelpCategory, string>;
export const HELP_STATUS_LABEL: Record<HelpStatus, string> = { baru: "Baru", diproses: "Diproses", selesai: "Selesai" };

/** At most this many new messages per person per hour. */
export const HELP_PER_HOUR = 5;
/** An attached image is deleted automatically this many days after the ticket is marked Selesai. */
export const HELP_ATTACHMENT_DAYS = 30;
/** Attached images are resized on the device; the server accepts up to this size. */
export const HELP_IMAGE_MAX_BYTES = 600_000;

export interface HelpReply {
  id: string;
  fromAdmin: boolean;
  authorName: string;
  message: string;
  createdAt: string;
}

export interface HelpTicket {
  id: string;
  category: HelpCategory;
  message: string;
  status: HelpStatus;
  context: { page: string; role: string; temple?: string; device: string; browser: string; screen?: string };
  /** URL of the attached image (owner and Admin Utama only), if it still exists */
  attachment?: string;
  attachmentRemovedAt?: string;
  unreadByAdmin: boolean;
  unreadByUser: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  replies: HelpReply[];
  /** Admin inbox only */
  user?: { id: string; name: string; email: string };
}
