// Database schema (PostgreSQL). Column names are snake_case in the database and camelCase in code.
import { bigint, bigserial, boolean, customType, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { CampaignUpdate, PublishedReport, ReportBranding, TransparencySettings } from "@/lib/types";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const money = (name: string) => bigint(name, { mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  callName: text("call_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  avatarColor: text("avatar_color").notNull().default("#087F6D"),
  /** Profile photo (attachment id; 256×256, resized on the device). Never shown on public pages. */
  avatarId: text("avatar_id"),
  avatarAt: ts("avatar_at"),
  /** One short in-app message for this person only (e.g. "foto profil dihapus"); cleared when read. */
  notice: text("notice"),
  /** Legacy (Phase 2). Login now uses Google or one-time email links; no passwords are stored. */
  passwordHash: text("password_hash"),
  googleSub: text("google_sub").unique(),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  status: text("status").notNull().default("active"), // active | disabled | deleted
  emailDigest: boolean("email_digest").notNull().default(true),
  /** Email when one's own punia is disahkan or ditolak (can be switched off) */
  emailPunia: boolean("email_punia").notNull().default(true),
  /** Reading size, saved with the account: normal | besar | sangat_besar */
  textSize: text("text_size").notNull().default("normal"),
  lastDigestAt: ts("last_digest_at"),
  deletedAt: ts("deleted_at"),
  resetRequestedAt: ts("reset_requested_at"),
  lastLoginAt: ts("last_login_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("one_super_admin").on(t.isSuperAdmin).where(sql`${t.isSuperAdmin}`)]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // SHA-256 of the cookie token — the raw token is never stored
  userId: text("user_id").notNull().references(() => users.id),
  activeTempleId: text("active_temple_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  /** Admin Utama "Mode darurat": allowed to change data of this one temple until this time. */
  emergencyTempleId: text("emergency_temple_id"),
  emergencyUntil: ts("emergency_until"),
  emergencyReason: text("emergency_reason"),
}, (t) => [index("sessions_user").on(t.userId)]);

/** One-time sign-in links (stored only as a SHA-256 hash). */
export const passwordTokens = pgTable("password_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").references(() => users.id),
  email: text("email"),
  purpose: text("purpose").notNull(), // login (Phase 3); activation | reset are legacy
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdBy: text("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const loginAttempts = pgTable("login_attempts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  email: text("email").notNull(),
  ip: text("ip"),
  success: boolean("success").notNull(),
  at: ts("at").notNull().defaultNow(),
}, (t) => [index("login_attempts_email_at").on(t.email, t.at), index("login_attempts_ip_at").on(t.ip, t.at)]);

export const temples = pgTable("temples", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  // Only the name and banjar pengempon are required; location and contact are optional ("" = empty).
  // A temple has no email of its own: email is only for the people who sign in.
  province: text("province").notNull().default(""),
  regency: text("regency").notNull().default(""),
  district: text("district").notNull().default(""),
  village: text("village").notNull().default(""),
  address: text("address").notNull().default(""),
  description: text("description").notNull().default(""),
  phone: text("phone").notNull().default(""),
  // Kemendagri region codes ("51", "51.03", "51.03.05", "51.03.05.2001"). Empty when the place was
  // typed in by hand ("tidak ada di daftar") or entered before the dropdowns existed. The name
  // columns above stay filled in either way, so old records keep reading normally.
  provinceCode: text("province_code"),
  regencyCode: text("regency_code"),
  districtCode: text("district_code"),
  villageCode: text("village_code"),
  cover: text("cover").notNull().default("emerald"),
  photo: text("photo"),
  established: text("established"),
  /** pending | active | rejected | archived (hidden from the public, read-only, can be reactivated) */
  status: text("status").notNull().default("pending"),
  archivedAt: ts("archived_at"),
  archiveReason: text("archive_reason"),
  transparency: jsonb("transparency").$type<TransparencySettings>().notNull(),
  branding: jsonb("branding").$type<ReportBranding>().notNull(),
  txCounter: integer("tx_counter").notNull().default(0),
  /** Official account for punia transfers — editable by Admin Utama only. */
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  bankAccountHolder: text("bank_account_holder"),
  /** QRIS image (public attachment URL) and the bank account it pays into — Admin Utama only */
  qrisImage: text("qris_image"),
  qrisAccountId: text("qris_account_id"),
  // "Mulai memakai aplikasi": the cut-off date of the old books. Set once (database trigger);
  // no transaction may be dated before it.
  booksStartDate: date("books_start_date", { mode: "string" }),
  booksStartedAt: ts("books_started_at"),
  booksStartedBy: text("books_started_by"),
  /** The two pengurus who counted the opening balances together */
  booksWitnesses: text("books_witnesses"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** Banjar Pengempon. A temple can be supported by one or more banjar. */
export const banjars = pgTable("banjars", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  village: text("village").notNull().default(""),
  district: text("district").notNull().default(""),
  regency: text("regency").notNull().default(""),
  province: text("province").notNull().default(""),
  /** Street, number, gang, dusun … (optional) */
  address: text("address").notNull().default(""),
  // Kemendagri region codes ("51", "51.03", "51.03.05", "51.03.05.2001"). Empty when the place was
  // typed in by hand ("tidak ada di daftar") or entered before the dropdowns existed. The name
  // columns above stay filled in either way, so old records keep reading normally.
  provinceCode: text("province_code"),
  regencyCode: text("regency_code"),
  districtCode: text("district_code"),
  villageCode: text("village_code"),
  /** active | inactive (= diarsipkan: hidden from the public, its Pengurus Banjar can only read) */
  status: text("status").notNull().default("active"),
  archivedAt: ts("archived_at"),
  archiveReason: text("archive_reason"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("banjars_regency_code").on(t.regencyCode)]);

export const templeBanjars = pgTable("temple_banjars", {
  templeId: text("temple_id").notNull().references(() => temples.id),
  banjarId: text("banjar_id").notNull().references(() => banjars.id),
}, (t) => [primaryKey({ columns: [t.templeId, t.banjarId] }), index("temple_banjars_banjar").on(t.banjarId)]);

/** Pengurus Banjar: may open and verify punia at every temple the banjar supports. */
export const banjarMembers = pgTable("banjar_members", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  banjarId: text("banjar_id").notNull().references(() => banjars.id),
  status: text("status").notNull().default("active"),
  /** Jabatan in THIS banjar (kelian_banjar | sekretaris | bendahara | lainnya) — set by Admin Utama only */
  position: text("position"),
  /** Free title when position = lainnya (e.g. "Wakil Kelian") */
  positionTitle: text("position_title"),
}, (t) => [
  uniqueIndex("banjar_member_unique").on(t.userId, t.banjarId),
  // One Kelian / Sekretaris / Bendahara per banjar at a time.
  uniqueIndex("banjar_member_position_unique").on(t.banjarId, t.position).where(sql`position in ('ketua','kelian_banjar','sekretaris','bendahara') and status = 'active'`),
]);

export const memberships = pgTable("memberships", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  templeId: text("temple_id").notNull().references(() => temples.id),
  role: text("role").notNull(), // pengurus | pemeriksa
  status: text("status").notNull().default("active"),
  /** Jabatan in THIS temple's kepengurusan (ketua | sekretaris | bendahara | lainnya) — Admin Utama only */
  position: text("position"),
  positionTitle: text("position_title"),
}, (t) => [
  uniqueIndex("membership_unique").on(t.userId, t.templeId),
  // One Ketua / Sekretaris / Bendahara per temple at a time.
  uniqueIndex("membership_position_unique").on(t.templeId, t.position).where(sql`position in ('ketua','kelian_banjar','sekretaris','bendahara') and status = 'active'`),
]);

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  templeId: text("temple_id").notNull().references(() => temples.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  accountHolder: text("account_holder"),
  openingBalance: money("opening_balance").notNull().default(0),
  openingDate: date("opening_date", { mode: "string" }).notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  /** Nonaktif: hidden from new choices; its past transactions and balance stay. */
  archived: boolean("archived").notNull().default(false),
  /** Short name of a bank account for umat, e.g. "Kas Umum", "Pembangunan" */
  label: text("label").notNull().default(""),
  /** The temple's main bank account (at most one per temple); also mirrored on temples.bank_* */
  isPrimary: boolean("is_primary").notNull().default(false),
  /** Opening balance witnessed and locked (database trigger); changed only by openingCorrections */
  openingSetAt: ts("opening_set_at"),
  openingWitnesses: text("opening_witnesses"),
  /** Sum of the opening-balance corrections (kept by a database trigger, never set by the app) */
  openingAdjust: money("opening_adjust").notNull().default(0),
}, (t) => [uniqueIndex("accounts_one_primary").on(t.templeId).where(sql`${t.isPrimary}`)]);

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  templeId: text("temple_id").notNull().references(() => temples.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  icon: text("icon").notNull(),
  archived: boolean("archived").notNull().default(false),
});

export const activities = pgTable("activities", {
  id: text("id").primaryKey(),
  templeId: text("temple_id").notNull().references(() => temples.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  budget: money("budget").notNull().default(0),
  fundType: text("fund_type").notNull().default("general"),
  status: text("status").notNull().default("planned"),
  color: text("color").notNull().default("#087F6D"),
  /** The "Operasional Pura" activity created with every new temple; does not count as data. */
  auto: boolean("auto").notNull().default(false),
  /** Archived: hidden from new choices; its records and reports stay. Can be reactivated. */
  archivedAt: ts("archived_at"),
  archiveReason: text("archive_reason"),
});

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  number: text("number").notNull(),
  templeId: text("temple_id").notNull().references(() => temples.id),
  type: text("type").notNull(),
  amount: money("amount").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  categoryId: text("category_id"),
  description: text("description").notNull(),
  accountId: text("account_id").notNull(),
  toAccountId: text("to_account_id"),
  activityId: text("activity_id"),
  campaignId: text("campaign_id"),
  donationId: text("donation_id"),
  source: text("source"),
  receipt: text("receipt"),
  receiptName: text("receipt_name"),
  notes: text("notes"),
  status: text("status").notNull(),
  reversalOf: text("reversal_of"),
  reversedBy: text("reversed_by"),
  createdBy: text("created_by").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  idempotencyKey: text("idempotency_key"),
}, (t) => [
  index("tx_temple_date").on(t.templeId, t.date),
  uniqueIndex("tx_idempotency").on(t.templeId, t.idempotencyKey),
  uniqueIndex("tx_one_per_donation").on(t.donationId).where(sql`${t.donationId} is not null and ${t.reversalOf} is null`),
  uniqueIndex("tx_one_reversal").on(t.reversalOf),
]);

export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  templeId: text("temple_id").notNull().references(() => temples.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  cover: text("cover").notNull(),
  coverImage: text("cover_image"),
  activityId: text("activity_id"),
  /** 0 = no target: the public page shows no progress bar or percentage */
  target: money("target").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  /** null = no end date */
  endDate: date("end_date", { mode: "string" }),
  purpose: text("purpose").notNull(),
  accountId: text("account_id").notNull(),
  instructions: text("instructions").notNull(),
  manualVerification: boolean("manual_verification").notNull().default(true),
  showDonorList: boolean("show_donor_list").notNull().default(true),
  defaultPrivacy: text("default_privacy").notNull().default("public"),
  status: text("status").notNull(),
  updates: jsonb("updates").$type<CampaignUpdate[]>().notNull().default([]),
  createdAt: ts("created_at").notNull().defaultNow(),
  publishedAt: ts("published_at"),
  // Closed before its end date ("Tutup penggalangan"): reason shown publicly and never edited
  // afterwards (database trigger); corrections are appended to closeNotes.
  closedAt: ts("closed_at"),
  closeReason: text("close_reason"),
  closedBy: text("closed_by"),
  closeNotes: jsonb("close_notes").$type<{ at: string; text: string }[]>().notNull().default([]),
});

export const donations = pgTable("donations", {
  id: text("id").primaryKey(),
  templeId: text("temple_id").notNull().references(() => temples.id),
  /** The bank account the umat says they paid into (chosen when there is more than one) */
  accountId: text("account_id"),
  /** false = a decision (disahkan/ditolak) the umat has not seen yet in "Punia Saya" */
  donorSeen: boolean("donor_seen").notNull().default(true),
  campaignId: text("campaign_id").references(() => campaigns.id),
  activityId: text("activity_id"),
  purpose: text("purpose").notNull().default("umum"), // umum | odalan | pembangunan | lainnya
  donorName: text("donor_name").notNull(),
  amount: money("amount").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  privacy: text("privacy").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  evidence: text("evidence"),
  channel: text("channel").notNull(),
  transactionId: text("transaction_id"),
  verifiedAt: ts("verified_at"),
  verifiedBy: text("verified_by"),
  rejectedReason: text("rejected_reason"),
  transferDate: date("transfer_date", { mode: "string" }),
  referenceNo: text("reference_no"),
  /** Umat account that sent this punia (null for manual entries) */
  submittedBy: text("submitted_by"),
  submitterEmail: text("submitter_email"),
  /** Pengurus who typed in a manual (cash/WhatsApp) entry */
  inputBy: text("input_by"),
  evidenceHash: text("evidence_hash"),
  /** A verified punia is never edited: a mistake is cancelled with a correction (reversal) entry. */
  correctedAt: ts("corrected_at"),
  correctedBy: text("corrected_by"),
  correctionReason: text("correction_reason"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [
  index("donations_campaign").on(t.campaignId),
  index("donations_temple_status").on(t.templeId, t.status),
  index("donations_evidence_hash").on(t.evidenceHash),
  index("donations_submitted_by").on(t.submittedBy),
]);

export const reports = pgTable("reports", {
  id: text("id").primaryKey(),
  templeId: text("temple_id").notNull().references(() => temples.id),
  title: text("title").notNull(),
  periodStart: date("period_start", { mode: "string" }).notNull(),
  periodEnd: date("period_end", { mode: "string" }).notNull(),
  publishedAt: ts("published_at").notNull().defaultNow(),
  publishedBy: text("published_by").notNull(),
  snapshot: jsonb("snapshot").$type<PublishedReport["snapshot"]>().notNull(),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  templeId: text("temple_id").notNull().references(() => temples.id),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  date: ts("date").notNull().defaultNow(),
  read: boolean("read").notNull().default(false),
  href: text("href"),
});

/** Append-only. A database trigger blocks every UPDATE, DELETE and TRUNCATE. */
export const activityLog = pgTable("activity_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: ts("at").notNull().defaultNow(),
  actorId: text("actor_id"),
  actorName: text("actor_name").notNull(),
  actorEmail: text("actor_email"),
  templeId: text("temple_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  detail: text("detail").notNull(),
  changes: jsonb("changes"),
  ip: text("ip"),
  userAgent: text("user_agent"),
}, (t) => [index("log_at").on(t.at), index("log_temple_at").on(t.templeId, t.at)]);

export const attachments = pgTable("attachments", {
  id: text("id").primaryKey(),
  templeId: text("temple_id"),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
  size: integer("size").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  createdBy: text("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/**
 * "Ajukan pendaftaran": a banjar asks to use the app (public form, no login). Only Admin Utama can
 * read it. It never creates access by itself; Admin Utama turns it into a banjar + pura by hand.
 */
export const registrationRequests = pgTable("registration_requests", {
  id: text("id").primaryKey(),
  banjarName: text("banjar_name").notNull(),
  province: text("province").notNull().default(""),
  regency: text("regency").notNull().default(""),
  district: text("district").notNull().default(""),
  village: text("village").notNull().default(""),
  provinceCode: text("province_code"),
  regencyCode: text("regency_code"),
  districtCode: text("district_code"),
  villageCode: text("village_code"),
  templeName: text("temple_name").notNull(),
  applicantName: text("applicant_name").notNull(),
  applicantPosition: text("applicant_position").notNull(),
  whatsapp: text("whatsapp").notNull(),
  googleEmail: text("google_email").notNull(),
  referrerName: text("referrer_name").notNull(),
  referrerContact: text("referrer_contact").notNull(),
  reason: text("reason").notNull(),
  consentAt: ts("consent_at").notNull(),
  /** baru | verifikasi | disetujui | ditolak */
  status: text("status").notNull().default("baru"),
  internalNote: text("internal_note").notNull().default(""),
  convertedBanjarId: text("converted_banjar_id"),
  convertedTempleId: text("converted_temple_id"),
  decidedBy: text("decided_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("registration_status").on(t.status, t.createdAt)]);

/**
 * Internal verification checklist of a temple (Admin Utama only): when each check was done, the
 * trial period and free notes. Every change is written to the Log Aktivitas.
 */
export const templeVerifications = pgTable("temple_verifications", {
  templeId: text("temple_id").primaryKey().references(() => temples.id),
  referenceContactedAt: date("reference_contacted_at", { mode: "string" }),
  videoCallAt: date("video_call_at", { mode: "string" }),
  accountCheckedAt: date("account_checked_at", { mode: "string" }),
  /** pura | banjar | lain (the official account is in the name of …) */
  accountHolderType: text("account_holder_type"),
  trialStart: date("trial_start", { mode: "string" }),
  trialEnd: date("trial_end", { mode: "string" }),
  notes: text("notes").notNull().default(""),
  updatedBy: text("updated_by"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** A correction of a locked opening balance: append-only, with reason and two witnesses. */
export const openingCorrections = pgTable("opening_corrections", {
  id: text("id").primaryKey(),
  templeId: text("temple_id").notNull().references(() => temples.id),
  accountId: text("account_id").notNull().references(() => accounts.id),
  /** Signed: + adds to the opening balance, − takes off */
  amount: money("amount").notNull(),
  reason: text("reason").notNull(),
  witnesses: text("witnesses").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("opening_corrections_account").on(t.accountId)]);

/**
 * Monthly check (rekonsiliasi sederhana): the end-of-month balance from the bank statement or the
 * cash count, next to the balance the app calculated. A note only — it never changes a balance.
 * Append-only: a later check of the same month and account is shown instead of the earlier one.
 */
export const reconciliations = pgTable("reconciliations", {
  id: text("id").primaryKey(),
  templeId: text("temple_id").notNull().references(() => temples.id),
  accountId: text("account_id").notNull().references(() => accounts.id),
  /** yyyy-mm */
  month: text("month").notNull(),
  statementBalance: money("statement_balance").notNull(),
  /** The app's balance at the end of that month, at the moment of the check */
  appBalance: money("app_balance").notNull(),
  note: text("note").notNull().default(""),
  createdBy: text("created_by").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("reconciliations_temple_month").on(t.templeId, t.month)]);

/** Pusat bantuan: a message from a signed-in person to Admin Utama, with the page context. */
export const helpTickets = pgTable("help_tickets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  /** cara_pakai | masalah | usul | penyalahgunaan | lainnya */
  category: text("category").notNull(),
  message: text("message").notNull(),
  /** baru | diproses | selesai */
  status: text("status").notNull().default("baru"),
  /** Filled in by the server: page, role, temple, device, browser. Never financial data. */
  context: jsonb("context").$type<{ page: string; role: string; temple?: string; device: string; browser: string; screen?: string }>().notNull(),
  attachmentId: text("attachment_id"),
  /** When the image was removed automatically (N days after the ticket was finished) */
  attachmentRemovedAt: ts("attachment_removed_at"),
  unreadByAdmin: boolean("unread_by_admin").notNull().default(true),
  unreadByUser: boolean("unread_by_user").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  closedAt: ts("closed_at"),
}, (t) => [index("help_tickets_user").on(t.userId), index("help_tickets_status").on(t.status, t.updatedAt)]);

export const helpReplies = pgTable("help_replies", {
  id: text("id").primaryKey(),
  ticketId: text("ticket_id").notNull().references(() => helpTickets.id),
  authorId: text("author_id").notNull().references(() => users.id),
  fromAdmin: boolean("from_admin").notNull(),
  message: text("message").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("help_replies_ticket").on(t.ticketId, t.createdAt)]);

/**
 * Outgoing emails about punia (disahkan / ditolak). Queued in the same database transaction as the
 * decision, sent afterwards in small batches within the daily quota of the email service — so a
 * mass verification is never slowed down or undone by email trouble.
 */
export const emailQueue = pgTable("email_queue", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(), // punia_verified | punia_rejected
  userId: text("user_id").notNull(),
  donationId: text("donation_id"),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  textBody: text("text_body").notNull(),
  /** waiting | sent | failed (gave up after 5 tries) | cancelled (person switched emails off) */
  status: text("status").notNull().default("waiting"),
  attempts: integer("attempts").notNull().default(0),
  notBefore: ts("not_before").notNull().defaultNow(),
  lastError: text("last_error"),
  createdAt: ts("created_at").notNull().defaultNow(),
  sentAt: ts("sent_at"),
}, (t) => [index("email_queue_waiting").on(t.status, t.notBefore), index("email_queue_sent").on(t.sentAt)]);

export const rateLimits = pgTable("rate_limits", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  bucket: text("bucket").notNull(),
  at: ts("at").notNull().defaultNow(),
}, (t) => [index("rate_bucket_at").on(t.bucket, t.at)]);
