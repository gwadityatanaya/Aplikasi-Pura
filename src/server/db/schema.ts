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
  /** Legacy (Phase 2). Login now uses Google or one-time email links; no passwords are stored. */
  passwordHash: text("password_hash"),
  googleSub: text("google_sub").unique(),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  status: text("status").notNull().default("active"), // active | disabled | deleted
  emailDigest: boolean("email_digest").notNull().default(true),
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
  /** active | inactive (= diarsipkan: hidden from the public, its Pengurus Banjar lose access) */
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
  archived: boolean("archived").notNull().default(false),
});

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
  target: money("target").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
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
});

export const donations = pgTable("donations", {
  id: text("id").primaryKey(),
  templeId: text("temple_id").notNull().references(() => temples.id),
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

export const rateLimits = pgTable("rate_limits", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  bucket: text("bucket").notNull(),
  at: ts("at").notNull().defaultNow(),
}, (t) => [index("rate_bucket_at").on(t.bucket, t.at)]);
