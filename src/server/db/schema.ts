// Database schema (PostgreSQL). Column names are snake_case in the database and camelCase in code.
import { bigint, bigserial, boolean, customType, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
  passwordHash: text("password_hash"),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  status: text("status").notNull().default("active"), // active | disabled
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
}, (t) => [index("sessions_user").on(t.userId)]);

export const passwordTokens = pgTable("password_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  purpose: text("purpose").notNull(), // activation | reset
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
  province: text("province").notNull(),
  regency: text("regency").notNull(),
  district: text("district").notNull(),
  village: text("village").notNull(),
  address: text("address").notNull(),
  description: text("description").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  cover: text("cover").notNull().default("emerald"),
  photo: text("photo"),
  established: text("established"),
  status: text("status").notNull().default("pending"),
  transparency: jsonb("transparency").$type<TransparencySettings>().notNull(),
  branding: jsonb("branding").$type<ReportBranding>().notNull(),
  txCounter: integer("tx_counter").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const memberships = pgTable("memberships", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  templeId: text("temple_id").notNull().references(() => temples.id),
  role: text("role").notNull(), // ketua | bendahara | sekretaris | auditor
  status: text("status").notNull().default("active"),
}, (t) => [uniqueIndex("membership_unique").on(t.userId, t.templeId)]);

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
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
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
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("donations_campaign").on(t.campaignId)]);

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

export const rateLimits = pgTable("rate_limits", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  bucket: text("bucket").notNull(),
  at: ts("at").notNull().defaultNow(),
}, (t) => [index("rate_bucket_at").on(t.bucket, t.at)]);
