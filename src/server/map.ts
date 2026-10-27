import "server-only";
import type { schema } from "./db";
import type {
  Account, Activity, AppNotification, AuditEntry, Banjar, BanjarMember, Campaign, Category, Donation, Membership, PublishedReport, Temple,
  Transaction, TransparencySettings, User,
} from "@/lib/types";

type Row<T extends { $inferSelect: unknown }> = T["$inferSelect"];
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);
const u = <T>(v: T | null | undefined) => (v === null ? undefined : v) as T | undefined;

export const toUser = (r: Row<typeof schema.users>): User => ({
  id: r.id,
  name: r.name,
  callName: r.callName,
  email: r.email,
  phone: u(r.phone),
  avatarColor: r.avatarColor,
  isSuperAdmin: r.isSuperAdmin,
  status: r.status as User["status"],
  emailDigest: r.emailDigest,
  resetRequestedAt: iso(r.resetRequestedAt),
  lastLoginAt: iso(r.lastLoginAt),
  createdAt: r.createdAt.toISOString(),
});

export const DEFAULT_TRANSPARENCY: Required<TransparencySettings> = {
  showPublicProfile: true, showCampaigns: true, showPublishedSummaries: true, showDonorList: true, showBankAccount: true,
  showBalance: true, showRecentTransactions: true, recentCount: 5,
};

export const toTemple = (r: Row<typeof schema.temples>): Temple => ({
  id: r.id, slug: r.slug, name: r.name, province: r.province, regency: r.regency, district: r.district, village: r.village,
  address: r.address, description: r.description, phone: r.phone, email: u(r.email), cover: r.cover as Temple["cover"], photo: u(r.photo),
  established: u(r.established), status: r.status as Temple["status"], createdAt: r.createdAt.toISOString(),
  transparency: { ...DEFAULT_TRANSPARENCY, ...r.transparency }, branding: r.branding,
  bankName: u(r.bankName), bankAccountNumber: u(r.bankAccountNumber), bankAccountHolder: u(r.bankAccountHolder),
});

export const toBanjar = (r: Row<typeof schema.banjars>): Banjar => ({
  id: r.id, slug: r.slug, name: r.name, village: r.village, district: r.district, regency: r.regency, province: r.province,
  status: r.status as Banjar["status"], createdAt: r.createdAt.toISOString(),
});

export const toBanjarMember = (r: Row<typeof schema.banjarMembers>): BanjarMember => ({
  id: r.id, userId: r.userId, banjarId: r.banjarId, status: r.status as BanjarMember["status"],
});

export const toMembership = (r: Row<typeof schema.memberships>): Membership => ({
  id: r.id, userId: r.userId, templeId: r.templeId, role: r.role as Membership["role"], status: r.status as Membership["status"],
});

export const toAccount = (r: Row<typeof schema.accounts>): Account => ({
  id: r.id, templeId: r.templeId, name: r.name, type: r.type as Account["type"], bankName: u(r.bankName), accountNumber: u(r.accountNumber),
  accountHolder: u(r.accountHolder), openingBalance: r.openingBalance, openingDate: r.openingDate, isPublic: r.isPublic, archived: r.archived,
});

export const toCategory = (r: Row<typeof schema.categories>): Category => ({
  id: r.id, templeId: r.templeId, name: r.name, type: r.type as Category["type"], icon: r.icon, archived: r.archived,
});

export const toActivity = (r: Row<typeof schema.activities>): Activity => ({
  id: r.id, templeId: r.templeId, name: r.name, description: r.description, startDate: r.startDate, endDate: r.endDate, budget: r.budget,
  fundType: r.fundType as Activity["fundType"], status: r.status as Activity["status"], color: r.color,
});

export const toTx = (r: Row<typeof schema.transactions>): Transaction => ({
  id: r.id, number: r.number, templeId: r.templeId, type: r.type as Transaction["type"], amount: r.amount, date: r.date,
  categoryId: u(r.categoryId), description: r.description, accountId: r.accountId, toAccountId: u(r.toAccountId), activityId: u(r.activityId),
  campaignId: u(r.campaignId), donationId: u(r.donationId), source: u(r.source), receipt: u(r.receipt), receiptName: u(r.receiptName),
  notes: u(r.notes), status: r.status as Transaction["status"], reversalOf: u(r.reversalOf), reversedBy: u(r.reversedBy), createdBy: r.createdBy,
  createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), idempotencyKey: u(r.idempotencyKey),
});

export const toCampaign = (r: Row<typeof schema.campaigns>): Campaign => ({
  id: r.id, slug: r.slug, templeId: r.templeId, title: r.title, description: r.description, cover: r.cover as Campaign["cover"],
  coverImage: u(r.coverImage), activityId: u(r.activityId), target: r.target, startDate: r.startDate, endDate: r.endDate, purpose: r.purpose,
  accountId: r.accountId, instructions: r.instructions, manualVerification: r.manualVerification, showDonorList: r.showDonorList,
  defaultPrivacy: r.defaultPrivacy as Campaign["defaultPrivacy"], status: r.status as Campaign["status"], updates: r.updates ?? [],
  createdAt: r.createdAt.toISOString(), publishedAt: iso(r.publishedAt),
});

export const toDonation = (r: Row<typeof schema.donations>): Donation => ({
  id: r.id, templeId: r.templeId, campaignId: u(r.campaignId), activityId: u(r.activityId), purpose: r.purpose as Donation["purpose"],
  transferDate: u(r.transferDate), referenceNo: u(r.referenceNo), submittedBy: u(r.submittedBy), submitterEmail: u(r.submitterEmail),
  inputBy: u(r.inputBy), donorName: r.donorName, amount: r.amount, date: r.date,
  privacy: r.privacy as Donation["privacy"], status: r.status as Donation["status"], message: u(r.message), evidence: u(r.evidence),
  channel: r.channel as Donation["channel"], transactionId: u(r.transactionId), verifiedAt: iso(r.verifiedAt), verifiedBy: u(r.verifiedBy),
  rejectedReason: u(r.rejectedReason), createdAt: r.createdAt.toISOString(),
});

export const toReport = (r: Row<typeof schema.reports>): PublishedReport => ({
  id: r.id, templeId: r.templeId, title: r.title, periodStart: r.periodStart, periodEnd: r.periodEnd, publishedAt: r.publishedAt.toISOString(),
  publishedBy: r.publishedBy, snapshot: r.snapshot,
});

export const toNotification = (r: Row<typeof schema.notifications>): AppNotification => ({
  id: r.id, templeId: r.templeId, kind: r.kind as AppNotification["kind"], title: r.title, body: r.body, date: r.date.toISOString(), read: r.read, href: u(r.href),
});

export const toAudit = (r: Row<typeof schema.activityLog>): AuditEntry => ({
  id: String(r.id), templeId: r.templeId ?? "", actorId: r.actorId ?? "", actorName: r.actorName, action: r.action,
  entity: r.entity as AuditEntry["entity"], entityId: u(r.entityId), detail: r.detail, at: r.at.toISOString(),
  actorEmail: u(r.actorEmail), ip: u(r.ip), userAgent: u(r.userAgent), changes: r.changes ?? undefined,
});
