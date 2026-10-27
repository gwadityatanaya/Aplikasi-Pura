// Domain model for the PURA prototype.
// All money values are integers in Rupiah. All dates are ISO strings (YYYY-MM-DD or full ISO).

export type ID = string;

/**
 * Effective role for one temple, strongest first:
 * superadmin (Admin Utama) > pengurus (Pengurus Pura) > banjar (Pengurus Banjar) > pemeriksa (lihat saja).
 * Users with none of these are Umat.
 */
export type Role = "superadmin" | "pengurus" | "banjar" | "pemeriksa";
/** Roles that can be assigned per temple (through the Back Office). */
export type MemberRole = "pengurus" | "pemeriksa";

export interface User {
  id: ID;
  name: string;
  /** Short greeting form, e.g. "Pak Made" */
  callName: string;
  email: string;
  phone?: string;
  avatarColor: string;
  /** Admin Utama — set only through the secure setup step */
  isSuperAdmin?: boolean;
  status?: "active" | "disabled" | "deleted";
  /** Daily "punia menunggu" email for pengurus */
  emailDigest?: boolean;
  resetRequestedAt?: string;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Membership {
  id: ID;
  userId: ID;
  templeId: ID;
  role: MemberRole;
  status: "active" | "invited";
}

export type CoverVariant = "emerald" | "dusk" | "gold" | "ocean" | "forest";

export interface Temple {
  id: ID;
  slug: string;
  name: string;
  province: string;
  regency: string;
  district: string;
  village: string;
  address: string;
  description: string;
  phone: string;
  email?: string;
  cover: CoverVariant;
  /** Optional uploaded photo (data URL, compressed) */
  photo?: string;
  established?: string;
  status: "active" | "pending" | "rejected";
  createdAt: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  /** Banjar Pengempon */
  banjarIds?: ID[];
  /** Number of active Pengurus Pura (0 = "Pengurus pura belum terdaftar") */
  pengurusCount?: number;
  transparency: TransparencySettings;
  branding: ReportBranding;
}

export interface TransparencySettings {
  showPublicProfile: boolean;
  showCampaigns: boolean;
  showPublishedSummaries: boolean;
  /** Daftar punia terverifikasi */
  showDonorList: boolean;
  showBankAccount: boolean;
  /** Posisi kas (berdasarkan pencatatan pengurus) */
  showBalance?: boolean;
  showRecentTransactions?: boolean;
  /** 3–5 */
  recentCount?: number;
}

export interface Banjar {
  id: ID;
  slug: string;
  name: string;
  village: string;
  district: string;
  regency: string;
  province: string;
  status: "active" | "inactive";
  createdAt: string;
}

export interface TempleBanjar {
  templeId: ID;
  banjarId: ID;
}

export interface BanjarMember {
  id: ID;
  userId: ID;
  banjarId: ID;
  status: "active" | "disabled";
}

export interface ReportBranding {
  headerTitle: string;
  signatoryName: string;
  signatoryRole: string;
  footerNote: string;
}

export type AccountType = "cash" | "bank";

export interface Account {
  id: ID;
  templeId: ID;
  name: string;
  type: AccountType;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  openingBalance: number;
  openingDate: string;
  isPublic?: boolean;
  archived?: boolean;
}

export type TxType = "income" | "expense" | "transfer";

export interface Category {
  id: ID;
  templeId: ID;
  name: string;
  type: "income" | "expense";
  icon: string;
  archived?: boolean;
}

export type FundType = "general" | "restricted";

export interface Activity {
  id: ID;
  templeId: ID;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  budget: number;
  fundType: FundType;
  status: "planned" | "ongoing" | "done";
  color: string;
}

export type TxStatus = "draft" | "confirmed";

export interface Transaction {
  id: ID;
  /** Human-friendly number e.g. TRX-2026-0042 */
  number: string;
  templeId: ID;
  type: TxType;
  amount: number;
  date: string;
  categoryId?: ID;
  description: string;
  accountId: ID;
  /** For transfers: the destination account */
  toAccountId?: ID;
  activityId?: ID;
  campaignId?: ID;
  donationId?: ID;
  source?: string;
  receipt?: string;
  receiptName?: string;
  notes?: string;
  status: TxStatus;
  /** If this entry reverses another entry */
  reversalOf?: ID;
  /** Set on the original entry when a reversal exists */
  reversedBy?: ID;
  createdBy: ID;
  createdAt: string;
  updatedAt: string;
  /** Client-side idempotency key used to prevent duplicate submission */
  idempotencyKey?: string;
}

export type CampaignStatus = "draft" | "active" | "completed";

export interface CampaignUpdate {
  id: ID;
  date: string;
  title: string;
  body: string;
}

export interface Campaign {
  id: ID;
  slug: string;
  templeId: ID;
  title: string;
  description: string;
  cover: CoverVariant;
  coverImage?: string;
  activityId?: ID;
  target: number;
  startDate: string;
  endDate: string;
  purpose: string;
  accountId: ID;
  instructions: string;
  manualVerification: boolean;
  showDonorList: boolean;
  defaultPrivacy: DonorPrivacy;
  status: CampaignStatus;
  updates: CampaignUpdate[];
  createdAt: string;
  publishedAt?: string;
}

export type DonorPrivacy = "public" | "anonymous" | "private";
export type DonationStatus = "pending" | "verified" | "rejected";

export type PuniaPurpose = "umum" | "odalan" | "pembangunan" | "lainnya";

export interface Donation {
  id: ID;
  templeId: ID;
  campaignId?: ID;
  activityId?: ID;
  purpose?: PuniaPurpose;
  transferDate?: string;
  referenceNo?: string;
  submittedBy?: ID;
  submitterEmail?: string;
  inputBy?: ID;
  /** Computed by the server for pengurus: same amount + date as another punia */
  possibleDuplicate?: boolean;
  donorName: string;
  amount: number;
  date: string;
  privacy: DonorPrivacy;
  status: DonationStatus;
  message?: string;
  evidence?: string;
  channel: "transfer" | "tunai" | "whatsapp" | "simulasi";
  simulated?: boolean;
  /** Public API only: number of private donations aggregated into this row */
  count?: number;
  transactionId?: ID;
  verifiedAt?: string;
  verifiedBy?: ID;
  rejectedReason?: string;
  createdAt: string;
}

export interface PublishedReport {
  id: ID;
  templeId: ID;
  title: string;
  periodStart: string;
  periodEnd: string;
  publishedAt: string;
  publishedBy: ID;
  /** Frozen snapshot: public pages only ever read this, never the private ledger */
  snapshot: {
    openingBalance: number;
    income: number;
    expense: number;
    closingBalance: number;
    incomeByCategory: { name: string; amount: number }[];
    expenseByCategory: { name: string; amount: number }[];
    note?: string;
  };
}

export type NotificationKind =
  | "donation_pending"
  | "target_reached"
  | "report_ready"
  | "tx_approval"
  | "campaign_ending"
  | "info";

export interface AppNotification {
  id: ID;
  templeId: ID;
  kind: NotificationKind;
  title: string;
  body: string;
  date: string;
  read: boolean;
  href?: string;
}

export interface AuditEntry {
  id: ID;
  templeId: ID;
  actorId: ID;
  actorName: string;
  action: string;
  entity: "transaction" | "campaign" | "donation" | "activity" | "report" | "settings" | "user" | "session" | "backup";
  entityId?: ID;
  detail: string;
  at: string;
  actorEmail?: string;
  ip?: string;
  userAgent?: string;
  changes?: unknown;
}

export interface NotificationPrefs {
  donationPending: boolean;
  campaignTarget: boolean;
  campaignEnding: boolean;
  reportReady: boolean;
  approvals: boolean;
  weeklySummary: boolean;
}

export interface Session {
  userId: ID;
  activeTempleId?: ID;
  /** Prototype only: lets a demo viewer preview other roles */
  roleOverride?: Role;
  startedAt: string;
}

export interface PasswordResetRequest {
  email: string;
  token: string;
  createdAt: string;
}

export interface Preferences {
  textSize: "normal" | "large";
  reduceMotion: boolean;
  notifications: NotificationPrefs;
}

export interface DataState {
  version: number;
  users: User[];
  memberships: Membership[];
  temples: Temple[];
  banjars: Banjar[];
  templeBanjars: TempleBanjar[];
  banjarMembers: BanjarMember[];
  accounts: Account[];
  categories: Category[];
  activities: Activity[];
  transactions: Transaction[];
  campaigns: Campaign[];
  donations: Donation[];
  reports: PublishedReport[];
  notifications: AppNotification[];
  audit: AuditEntry[];
  counters: { tx: number };
  resetRequests: PasswordResetRequest[];
}
