// Fictional seed data. Every total shown anywhere in the app is derived from these records.
// Names, account numbers and amounts are invented for demonstration purposes.
import type {
  Account,
  Activity,
  AppNotification,
  AuditEntry,
  Campaign,
  Category,
  DataState,
  Donation,
  DonorPrivacy,
  Membership,
  PublishedReport,
  Temple,
  Transaction,
  User,
} from "./types";
import { accountBalance, byCategory, summarize } from "./ledger";

export const SEED_VERSION = 4;
export const DEMO_TODAY = "2026-10-27";

const defaultTransparency = {
  showPublicProfile: true,
  showCampaigns: true,
  showPublishedSummaries: true,
  showDonorList: true,
  showBankAccount: true,
};

function branding(name: string, signatory: string, role = "Ketua Pengempon") {
  return {
    headerTitle: `Laporan Keuangan ${name}`,
    signatoryName: signatory,
    signatoryRole: role,
    footerNote: "Laporan ini disusun secara transparan untuk krama pengempon pura.",
  };
}

const users: User[] = [
  { id: "u_made", name: "I Made Wirata", callName: "Pak Made", email: "made@pura.demo", phone: "0812-3700-1122", avatarColor: "#087F6D", createdAt: "2025-12-01T08:00:00" },
  { id: "u_ayu", name: "Ni Ketut Ayu Rahayu", callName: "Bu Ayu", email: "ayu@pura.demo", phone: "0819-0712-3344", avatarColor: "#C9A86A", createdAt: "2025-12-02T08:00:00" },
  { id: "u_wayan", name: "I Wayan Sudiarta", callName: "Pak Wayan", email: "wayan@pura.demo", avatarColor: "#3F6FB5", createdAt: "2025-12-03T08:00:00" },
  { id: "u_nyoman", name: "I Nyoman Gede Artha", callName: "Pak Nyoman", email: "nyoman@pura.demo", avatarColor: "#8A5CB8", createdAt: "2025-12-05T08:00:00" },
  { id: "u_platform", name: "Tim Platform PURA", callName: "Tim PURA", email: "admin@pura.demo", avatarColor: "#17212B", isPlatformAdmin: true, createdAt: "2025-11-01T08:00:00" },
  { id: "u_putu", name: "I Putu Darma Yasa", callName: "Pak Putu", email: "putu@pura.demo", avatarColor: "#B5543F", createdAt: "2026-02-10T08:00:00" },
];

const temples: Temple[] = [
  {
    id: "t_durgandhini",
    slug: "pura-dalem-durgandhini",
    name: "Pura Dalem Durgandhini",
    province: "Nusa Tenggara Barat",
    regency: "Lombok Barat",
    district: "Gerung",
    village: "Dasan Geres",
    address: "Jl. Raya Gerung No. 17, Dasan Geres, Gerung, Lombok Barat",
    description:
      "Pura Dalem Durgandhini adalah pura kahyangan desa yang diempon oleh krama Banjar Adat Gerung. Setiap tahun pura ini menggelar Piodalan pada Purnama Kalima yang dihadiri ratusan umat dari seluruh Lombok Barat. Pengelolaan dana punia dilakukan secara terbuka oleh prajuru pura.",
    phone: "0812-3700-1122",
    email: "prajuru.durgandhini@pura.demo",
    cover: "emerald",
    established: "1928",
    status: "active",
    createdAt: "2025-12-01T08:00:00",
    transparency: defaultTransparency,
    branding: branding("Pura Dalem Durgandhini", "I Made Wirata"),
  },
  {
    id: "t_girikencana",
    slug: "pura-puseh-giri-kencana",
    name: "Pura Puseh Giri Kencana",
    province: "Nusa Tenggara Barat",
    regency: "Lombok Barat",
    district: "Narmada",
    village: "Sesaot",
    address: "Dusun Kebon Bukit, Sesaot, Narmada, Lombok Barat",
    description:
      "Pura Puseh di kaki perbukitan Sesaot dengan suasana hutan yang sejuk. Saat ini krama sedang menggalang dana untuk renovasi Padmasana.",
    phone: "0818-0533-7720",
    cover: "forest",
    status: "active",
    createdAt: "2026-01-15T08:00:00",
    transparency: defaultTransparency,
    branding: branding("Pura Puseh Giri Kencana", "I Putu Darma Yasa"),
  },
  {
    id: "t_tamansari",
    slug: "pura-desa-taman-sari",
    name: "Pura Desa Taman Sari",
    province: "Nusa Tenggara Barat",
    regency: "Kota Mataram",
    district: "Cakranegara",
    village: "Cakranegara Barat",
    address: "Jl. Taman Sari No. 4, Cakranegara, Mataram",
    description:
      "Pura desa di tengah Kota Mataram yang menjadi pusat kegiatan keagamaan krama Cakranegara Barat.",
    phone: "0370-555-0142",
    cover: "gold",
    status: "active",
    createdAt: "2026-02-01T08:00:00",
    transparency: defaultTransparency,
    branding: branding("Pura Desa Taman Sari", "I Ketut Wiratma"),
  },
  {
    id: "t_batulumbung",
    slug: "pura-segara-batu-lumbung",
    name: "Pura Segara Batu Lumbung",
    province: "Nusa Tenggara Barat",
    regency: "Lombok Utara",
    district: "Tanjung",
    village: "Sigar Penjalin",
    address: "Pantai Batu Lumbung, Sigar Penjalin, Tanjung, Lombok Utara",
    description: "Pura segara di tepi pantai utara Lombok, tempat upacara melasti setiap menjelang Nyepi.",
    phone: "0817-5730-9910",
    cover: "ocean",
    status: "active",
    createdAt: "2026-03-01T08:00:00",
    transparency: defaultTransparency,
    branding: branding("Pura Segara Batu Lumbung", "I Gede Mertayasa"),
  },
  {
    id: "t_sweta",
    slug: "pura-penataran-agung-sweta",
    name: "Pura Penataran Agung Sweta",
    province: "Nusa Tenggara Barat",
    regency: "Kota Mataram",
    district: "Sandubaya",
    village: "Sweta",
    address: "Jl. Sweta Raya No. 88, Sandubaya, Mataram",
    description: "Pura penataran yang ramai dikunjungi umat saat hari raya Galungan dan Kuningan.",
    phone: "0370-555-0199",
    cover: "dusk",
    status: "active",
    createdAt: "2026-03-10T08:00:00",
    transparency: defaultTransparency,
    branding: branding("Pura Penataran Agung Sweta", "I Wayan Kariasa"),
  },
  {
    id: "t_pending",
    slug: "pura-melanting-pasar-kebon-roek",
    name: "Pura Melanting Pasar Kebon Roek",
    province: "Nusa Tenggara Barat",
    regency: "Kota Mataram",
    district: "Ampenan",
    village: "Pejeruk",
    address: "Kompleks Pasar Kebon Roek, Ampenan, Mataram",
    description: "Pendaftaran baru — menunggu peninjauan tim platform.",
    phone: "0819-1700-4455",
    cover: "gold",
    status: "pending",
    createdAt: "2026-10-24T10:12:00",
    transparency: defaultTransparency,
    branding: branding("Pura Melanting Pasar Kebon Roek", "I Komang Sutama"),
  },
];

const memberships: Membership[] = [
  { id: "m1", userId: "u_made", templeId: "t_durgandhini", role: "ketua", status: "active" },
  { id: "m2", userId: "u_ayu", templeId: "t_durgandhini", role: "bendahara", status: "active" },
  { id: "m3", userId: "u_wayan", templeId: "t_durgandhini", role: "sekretaris", status: "active" },
  { id: "m4", userId: "u_nyoman", templeId: "t_durgandhini", role: "auditor", status: "active" },
  { id: "m5", userId: "u_made", templeId: "t_girikencana", role: "bendahara", status: "active" },
  { id: "m6", userId: "u_putu", templeId: "t_girikencana", role: "ketua", status: "active" },
  { id: "m7", userId: "u_platform", templeId: "t_durgandhini", role: "platform", status: "active" },
];

function cats(templeId: string): Category[] {
  const p = templeId.replace("t_", "");
  return [
    { id: `c_${p}_punia`, templeId, name: "Dana Punia Krama", type: "income", icon: "HandHeart" },
    { id: `c_${p}_sesari`, templeId, name: "Sesari / Kotak Punia", type: "income", icon: "Coins" },
    { id: `c_${p}_campaign`, templeId, name: "Donasi Penggalangan Dana", type: "income", icon: "Megaphone" },
    { id: `c_${p}_sewa`, templeId, name: "Sewa Wantilan", type: "income", icon: "Building2" },
    { id: `c_${p}_bunga`, templeId, name: "Bunga & Jasa Bank", type: "income", icon: "Landmark" },
    { id: `c_${p}_inlain`, templeId, name: "Pemasukan Lain-lain", type: "income", icon: "CirclePlus" },
    { id: `c_${p}_upakara`, templeId, name: "Upakara & Banten", type: "expense", icon: "Flower2" },
    { id: `c_${p}_utilitas`, templeId, name: "Listrik & Air", type: "expense", icon: "Zap" },
    { id: `c_${p}_honor`, templeId, name: "Honor Pemangku & Juru Sapuh", type: "expense", icon: "UserRound" },
    { id: `c_${p}_bangunan`, templeId, name: "Perbaikan & Pembangunan", type: "expense", icon: "Hammer" },
    { id: `c_${p}_konsumsi`, templeId, name: "Konsumsi & Rapat", type: "expense", icon: "UtensilsCrossed" },
    { id: `c_${p}_sewaalat`, templeId, name: "Sewa Tenda & Peralatan", type: "expense", icon: "Tent" },
    { id: `c_${p}_kebersihan`, templeId, name: "Kebersihan", type: "expense", icon: "Sparkles" },
    { id: `c_${p}_atk`, templeId, name: "ATK & Administrasi", type: "expense", icon: "FileText" },
    { id: `c_${p}_outlain`, templeId, name: "Pengeluaran Lain-lain", type: "expense", icon: "CircleMinus" },
  ];
}

const activities: Activity[] = [
  {
    id: "a_piodalan",
    templeId: "t_durgandhini",
    name: "Piodalan November 2026",
    description: "Upacara Piodalan tahunan pada Purnama Kalima, termasuk persiapan banten, tenda, gamelan dan konsumsi umat.",
    startDate: "2026-09-01",
    endDate: "2026-11-30",
    budget: 30_000_000,
    fundType: "restricted",
    status: "ongoing",
    color: "#087F6D",
  },
  {
    id: "a_balepiasan",
    templeId: "t_durgandhini",
    name: "Pembangunan Bale Piasan",
    description: "Pembangunan Bale Piasan baru di jaba tengah untuk menggantikan bale lama yang rapuh.",
    startDate: "2026-06-01",
    endDate: "2027-03-31",
    budget: 75_000_000,
    fundType: "restricted",
    status: "ongoing",
    color: "#C9A86A",
  },
  {
    id: "a_pemeliharaan",
    templeId: "t_durgandhini",
    name: "Pemeliharaan Pura",
    description: "Perawatan rutin bangunan, pengecatan, perbaikan atap dan penyengker pura.",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    budget: 20_000_000,
    fundType: "general",
    status: "ongoing",
    color: "#3F6FB5",
  },
  {
    id: "a_operasional",
    templeId: "t_durgandhini",
    name: "Operasional Pura",
    description: "Kebutuhan rutin: banten purnama-tilem, listrik, air, kebersihan dan honor juru sapuh.",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    budget: 24_000_000,
    fundType: "general",
    status: "ongoing",
    color: "#8A5CB8",
  },
  {
    id: "a_gk_padmasana",
    templeId: "t_girikencana",
    name: "Renovasi Padmasana",
    description: "Renovasi Padmasana utama yang retak setelah gempa.",
    startDate: "2026-05-01",
    endDate: "2026-12-31",
    budget: 50_000_000,
    fundType: "restricted",
    status: "ongoing",
    color: "#087F6D",
  },
  {
    id: "a_gk_operasional",
    templeId: "t_girikencana",
    name: "Operasional Pura",
    description: "Kebutuhan rutin pura.",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    budget: 12_000_000,
    fundType: "general",
    status: "ongoing",
    color: "#8A5CB8",
  },
];

const accounts: Account[] = [
  { id: "acc_dg_kas", templeId: "t_durgandhini", name: "Kas Tunai Pura", type: "cash", openingBalance: 0, openingDate: "2026-01-01" },
  {
    id: "acc_dg_bank",
    templeId: "t_durgandhini",
    name: "Rekening Pura",
    type: "bank",
    bankName: "Bank Daerah NTB",
    accountNumber: "0012 3456 7890",
    accountHolder: "Pura Dalem Durgandhini",
    openingBalance: 0,
    openingDate: "2026-01-01",
    isPublic: true,
  },
  { id: "acc_gk_kas", templeId: "t_girikencana", name: "Kas Tunai Pura", type: "cash", openingBalance: 1_250_000, openingDate: "2026-01-01" },
  { id: "acc_gk_bank", templeId: "t_girikencana", name: "Rekening Pura", type: "bank", bankName: "Bank Daerah NTB", accountNumber: "0012 7788 1020", accountHolder: "Pura Puseh Giri Kencana", openingBalance: 6_400_000, openingDate: "2026-01-01", isPublic: true },
  { id: "acc_ts_bank", templeId: "t_tamansari", name: "Rekening Pura", type: "bank", bankName: "Bank Rakyat Contoh", accountNumber: "4410 0100 2233", accountHolder: "Pura Desa Taman Sari", openingBalance: 9_800_000, openingDate: "2026-01-01", isPublic: true },
  { id: "acc_bl_bank", templeId: "t_batulumbung", name: "Rekening Pura", type: "bank", bankName: "Bank Daerah NTB", accountNumber: "0012 5500 9182", accountHolder: "Pura Segara Batu Lumbung", openingBalance: 4_150_000, openingDate: "2026-01-01", isPublic: true },
  { id: "acc_sw_bank", templeId: "t_sweta", name: "Rekening Pura", type: "bank", bankName: "Bank Rakyat Contoh", accountNumber: "4410 0100 7781", accountHolder: "Pura Penataran Agung Sweta", openingBalance: 12_300_000, openingDate: "2026-01-01", isPublic: true },
];

const campaigns: Campaign[] = [
  {
    id: "cp_piodalan",
    slug: "dana-punia-piodalan-november-2026",
    templeId: "t_durgandhini",
    title: "Dana Punia Piodalan November 2026",
    description:
      "Mari bersama menyukseskan Piodalan Pura Dalem Durgandhini pada Purnama Kalima, 24 November 2026. Dana punia akan digunakan untuk upakara dan banten, sewa tenda, gamelan, serta konsumsi bagi umat yang tangkil. Setiap rupiah dicatat dan dilaporkan secara terbuka kepada krama.",
    cover: "emerald",
    activityId: "a_piodalan",
    target: 30_000_000,
    startDate: "2026-09-01",
    endDate: "2026-11-20",
    purpose: "Upakara, banten, sewa tenda, gamelan dan konsumsi Piodalan",
    accountId: "acc_dg_bank",
    instructions:
      "Transfer ke rekening resmi pura di bawah ini, lalu kirim bukti transfer ke bendahara melalui WhatsApp 0819-0712-3344. Dana punia tunai dapat diserahkan langsung kepada prajuru di pura.",
    manualVerification: true,
    showDonorList: true,
    defaultPrivacy: "public",
    status: "active",
    createdAt: "2026-08-28T09:00:00",
    publishedAt: "2026-09-01T07:00:00",
    updates: [
      { id: "up1", date: "2026-10-20", title: "Bahan banten mulai dibeli", body: "Prajuru telah membeli bahan banten tahap pertama senilai Rp2.350.000. Nota tersimpan dan dapat diperiksa saat paruman." },
      { id: "up2", date: "2026-10-05", title: "Tenda sudah dipesan", body: "Uang muka sewa tenda sebesar Rp1.500.000 telah dibayarkan untuk 3 hari pelaksanaan Piodalan." },
      { id: "up3", date: "2026-09-01", title: "Penggalangan dana dibuka", body: "Om Swastyastu. Penggalangan dana punia Piodalan resmi dibuka. Suksma atas dukungan krama semua." },
    ],
  },
  {
    id: "cp_balepiasan",
    slug: "pembangunan-bale-piasan",
    templeId: "t_durgandhini",
    title: "Pembangunan Bale Piasan",
    description:
      "Bale Piasan lama di jaba tengah sudah rapuh dimakan usia. Krama sepakat membangun Bale Piasan baru dengan konstruksi kayu dan atap genteng tradisional. Dana dikelola terpisah sebagai dana khusus pembangunan.",
    cover: "gold",
    activityId: "a_balepiasan",
    target: 75_000_000,
    startDate: "2026-06-01",
    endDate: "2027-02-28",
    purpose: "Material, ongkos tukang dan upacara pemelaspas Bale Piasan",
    accountId: "acc_dg_bank",
    instructions: "Transfer ke rekening resmi pura dan tuliskan berita \"BALE PIASAN\". Konfirmasi ke bendahara pura.",
    manualVerification: true,
    showDonorList: true,
    defaultPrivacy: "public",
    status: "active",
    createdAt: "2026-05-25T09:00:00",
    publishedAt: "2026-06-01T07:00:00",
    updates: [
      { id: "up4", date: "2026-09-12", title: "Material kayu tiba", body: "Kayu untuk tiang dan rangka bale telah tiba di pura. Pengerjaan dimulai setelah hari baik." },
    ],
  },
  {
    id: "cp_penyengker",
    slug: "perbaikan-penyengker-pura",
    templeId: "t_durgandhini",
    title: "Perbaikan Penyengker Pura",
    description: "Perbaikan tembok penyengker sisi utara yang runtuh akibat hujan deras.",
    cover: "forest",
    activityId: "a_pemeliharaan",
    target: 10_000_000,
    startDate: "2026-03-01",
    endDate: "2026-05-15",
    purpose: "Perbaikan tembok penyengker",
    accountId: "acc_dg_bank",
    instructions: "Penggalangan dana telah selesai. Suksma.",
    manualVerification: true,
    showDonorList: true,
    defaultPrivacy: "public",
    status: "completed",
    createdAt: "2026-02-25T09:00:00",
    publishedAt: "2026-03-01T07:00:00",
    updates: [{ id: "up5", date: "2026-05-20", title: "Target tercapai, perbaikan selesai", body: "Tembok penyengker sisi utara selesai diperbaiki. Suksma atas punia krama." }],
  },
  {
    id: "cp_galungan_draft",
    slug: "punia-galungan-2027",
    templeId: "t_durgandhini",
    title: "Punia Hari Raya Galungan 2027",
    description: "Draf penggalangan dana untuk persiapan Galungan tahun depan.",
    cover: "dusk",
    activityId: "a_operasional",
    target: 8_000_000,
    startDate: "2027-01-05",
    endDate: "2027-02-10",
    purpose: "Banten dan penjor Galungan",
    accountId: "acc_dg_bank",
    instructions: "Transfer ke rekening resmi pura.",
    manualVerification: true,
    showDonorList: true,
    defaultPrivacy: "public",
    status: "draft",
    createdAt: "2026-10-18T09:00:00",
    updates: [],
  },
  {
    id: "cp_padmasana",
    slug: "renovasi-padmasana-giri-kencana",
    templeId: "t_girikencana",
    title: "Renovasi Padmasana Pura Puseh Giri Kencana",
    description: "Padmasana utama mengalami retak setelah gempa. Dana punia digunakan untuk renovasi struktur dan ukiran.",
    cover: "forest",
    activityId: "a_gk_padmasana",
    target: 50_000_000,
    startDate: "2026-05-01",
    endDate: "2026-12-31",
    purpose: "Renovasi struktur dan ukiran Padmasana",
    accountId: "acc_gk_bank",
    instructions: "Transfer ke rekening resmi pura, berita \"PADMASANA\".",
    manualVerification: true,
    showDonorList: true,
    defaultPrivacy: "public",
    status: "active",
    createdAt: "2026-04-25T09:00:00",
    publishedAt: "2026-05-01T07:00:00",
    updates: [],
  },
  {
    id: "cp_tamansari",
    slug: "dana-punia-galungan-taman-sari",
    templeId: "t_tamansari",
    title: "Dana Punia Penjor & Banten Galungan",
    description: "Persiapan penjor dan banten Hari Raya Galungan untuk Pura Desa Taman Sari.",
    cover: "gold",
    target: 12_000_000,
    startDate: "2026-10-01",
    endDate: "2026-12-10",
    purpose: "Penjor, banten dan konsumsi",
    accountId: "acc_ts_bank",
    instructions: "Transfer ke rekening resmi pura.",
    manualVerification: true,
    showDonorList: true,
    defaultPrivacy: "public",
    status: "active",
    createdAt: "2026-09-28T09:00:00",
    publishedAt: "2026-10-01T07:00:00",
    updates: [],
  },
  {
    id: "cp_sweta",
    slug: "pengecatan-candi-bentar-sweta",
    templeId: "t_sweta",
    title: "Pengecatan Ulang Candi Bentar",
    description: "Perawatan dan pengecatan ulang candi bentar dan kori agung.",
    cover: "dusk",
    target: 18_000_000,
    startDate: "2026-08-15",
    endDate: "2026-11-30",
    purpose: "Cat, perancah dan ongkos tukang",
    accountId: "acc_sw_bank",
    instructions: "Transfer ke rekening resmi pura.",
    manualVerification: true,
    showDonorList: true,
    defaultPrivacy: "public",
    status: "active",
    createdAt: "2026-08-10T09:00:00",
    publishedAt: "2026-08-15T07:00:00",
    updates: [],
  },
];

// ---------------------------------------------------------------------------
// Ledger builder
// ---------------------------------------------------------------------------

type TxInput = Omit<Transaction, "id" | "number" | "templeId" | "createdBy" | "createdAt" | "updatedAt" | "status"> & {
  status?: Transaction["status"];
};

function buildLedger() {
  const txs: Transaction[] = [];
  const donations: Donation[] = [];
  let n = 0;
  const add = (templeId: string, t: TxInput, by = "u_ayu") => {
    n++;
    const id = `tx_${String(n).padStart(4, "0")}`;
    txs.push({
      ...t,
      id,
      number: "",
      templeId,
      status: t.status ?? "confirmed",
      createdBy: by,
      createdAt: `${t.date}T09:${String(n % 60).padStart(2, "0")}:00`,
      updatedAt: `${t.date}T09:${String(n % 60).padStart(2, "0")}:00`,
    });
    return id;
  };

  const D = "t_durgandhini";
  const c = (k: string) => `c_durgandhini_${k}`;
  const KAS = "acc_dg_kas";
  const BANK = "acc_dg_bank";

  // Monthly routine Jan–Oct 2026
  const sesari = [620, 545, 710, 480, 830, 690, 575, 760, 640, 705];
  const sesari2 = [455, 510, 390, 605, 470, 520, 690, 445, 585, 610];
  const listrik = [312, 298, 305, 287, 321, 334, 341, 329, 316, 308];
  const banten = [350, 375, 420, 350, 390, 365, 410, 380, 395, 360];
  for (let m = 1; m <= 10; m++) {
    const mm = String(m).padStart(2, "0");
    add(D, { type: "income", amount: sesari[m - 1] * 1000, date: `2026-${mm}-05`, categoryId: c("sesari"), description: "Sesari Purnama", accountId: KAS, activityId: "a_operasional", source: "Kotak punia pura" });
    add(D, { type: "income", amount: sesari2[m - 1] * 1000, date: `2026-${mm}-19`, categoryId: c("sesari"), description: "Sesari Tilem", accountId: KAS, activityId: "a_operasional", source: "Kotak punia pura" });
    add(D, { type: "income", amount: 1_500_000, date: `2026-${mm}-10`, categoryId: c("punia"), description: "Iuran punia rutin krama Banjar Adat Gerung", accountId: BANK, activityId: "a_operasional", source: "Banjar Adat Gerung" });
    add(D, { type: "expense", amount: listrik[m - 1] * 1000, date: `2026-${mm}-12`, categoryId: c("utilitas"), description: "Tagihan listrik & air pura", accountId: BANK, activityId: "a_operasional" });
    add(D, { type: "expense", amount: 750_000, date: `2026-${mm}-25`, categoryId: c("honor"), description: "Honor juru sapuh & pemangku", accountId: KAS, activityId: "a_operasional" });
    add(D, { type: "expense", amount: banten[m - 1] * 1000, date: `2026-${mm}-04`, categoryId: c("upakara"), description: "Banten Purnama & Tilem", accountId: KAS, activityId: "a_operasional" });
    if (m % 3 === 0) {
      add(D, { type: "income", amount: [18_420, 21_150, 24_380][m / 3 - 1], date: `2026-${mm}-28`, categoryId: c("bunga"), description: "Jasa giro rekening pura", accountId: BANK });
      add(D, { type: "transfer", amount: 1_000_000, date: `2026-${mm}-27`, description: "Setor kas tunai ke rekening pura", accountId: KAS, toAccountId: BANK });
    }
  }
  // Wantilan rentals
  add(D, { type: "income", amount: 1_250_000, date: "2026-02-14", categoryId: c("sewa"), description: "Sewa wantilan untuk acara pernikahan", accountId: BANK, source: "Keluarga I Ketut Darsana" });
  add(D, { type: "income", amount: 1_000_000, date: "2026-07-18", categoryId: c("sewa"), description: "Sewa wantilan untuk pesangkepan sekaa", accountId: KAS, source: "Sekaa Teruna Dharma Kerti" });
  // Cleaning
  add(D, { type: "expense", amount: 425_000, date: "2026-03-22", categoryId: c("kebersihan"), description: "Ngayah bersih pura — konsumsi & alat kebersihan", accountId: KAS, activityId: "a_pemeliharaan" });
  add(D, { type: "expense", amount: 185_000, date: "2026-08-03", categoryId: c("atk"), description: "Buku kas, map dan alat tulis prajuru", accountId: KAS, activityId: "a_operasional" });
  // Maintenance
  add(D, { type: "expense", amount: 2_750_000, date: "2026-04-08", categoryId: c("bangunan"), description: "Perbaikan atap bale kulkul", accountId: BANK, activityId: "a_pemeliharaan" });
  add(D, { type: "expense", amount: 1_850_000, date: "2026-08-15", categoryId: c("bangunan"), description: "Cat tembok & kayu bale pewaregan", accountId: BANK, activityId: "a_pemeliharaan" });
  // Penyengker project (spent from completed campaign)
  add(D, { type: "expense", amount: 6_200_000, date: "2026-05-02", categoryId: c("bangunan"), description: "Material batu bata & semen penyengker", accountId: BANK, activityId: "a_pemeliharaan", campaignId: "cp_penyengker" });
  add(D, { type: "expense", amount: 3_900_000, date: "2026-05-18", categoryId: c("bangunan"), description: "Ongkos tukang perbaikan penyengker", accountId: BANK, activityId: "a_pemeliharaan", campaignId: "cp_penyengker" });
  // Bale Piasan
  add(D, { type: "expense", amount: 4_500_000, date: "2026-07-21", categoryId: c("bangunan"), description: "Material batu bata & pasir Bale Piasan", accountId: BANK, activityId: "a_balepiasan", campaignId: "cp_balepiasan" });
  add(D, { type: "expense", amount: 3_200_000, date: "2026-09-11", categoryId: c("bangunan"), description: "Kayu tiang & rangka Bale Piasan", accountId: BANK, activityId: "a_balepiasan", campaignId: "cp_balepiasan" });
  // Piodalan prep
  add(D, { type: "expense", amount: 1_500_000, date: "2026-10-05", categoryId: c("sewaalat"), description: "Uang muka sewa tenda Piodalan", accountId: BANK, activityId: "a_piodalan", campaignId: "cp_piodalan" });
  add(D, { type: "expense", amount: 450_000, date: "2026-10-11", categoryId: c("konsumsi"), description: "Konsumsi rapat panitia Piodalan", accountId: KAS, activityId: "a_piodalan" });
  add(D, { type: "expense", amount: 2_350_000, date: "2026-10-20", categoryId: c("upakara"), description: "Bahan banten Piodalan tahap 1", accountId: BANK, activityId: "a_piodalan", campaignId: "cp_piodalan" });
  // Hari raya & additional project costs
  add(D, { type: "expense", amount: 2_400_000, date: "2026-01-14", categoryId: c("upakara"), description: "Banten Hari Raya Galungan & Kuningan", accountId: BANK, activityId: "a_operasional" });
  add(D, { type: "expense", amount: 1_950_000, date: "2026-03-17", categoryId: c("upakara"), description: "Upakara Melasti & Tawur Kesanga", accountId: BANK, activityId: "a_operasional" });
  add(D, { type: "expense", amount: 2_200_000, date: "2026-06-10", categoryId: c("bangunan"), description: "Pengecatan pelinggih & prada emas", accountId: BANK, activityId: "a_pemeliharaan" });
  add(D, { type: "expense", amount: 2_600_000, date: "2026-08-12", categoryId: c("upakara"), description: "Banten Hari Raya Galungan & Kuningan", accountId: BANK, activityId: "a_operasional" });
  add(D, { type: "expense", amount: 3_000_000, date: "2026-10-01", categoryId: c("bangunan"), description: "Ongkos tukang Bale Piasan tahap 1", accountId: BANK, activityId: "a_balepiasan", campaignId: "cp_balepiasan" });
  add(D, { type: "expense", amount: 1_500_000, date: "2026-10-14", categoryId: c("bangunan"), description: "Genteng & kayu usuk Bale Piasan", accountId: BANK, activityId: "a_balepiasan", campaignId: "cp_balepiasan" });
  add(D, { type: "expense", amount: 1_000_000, date: "2026-10-16", categoryId: c("sewaalat"), description: "Uang muka sekaa gamelan Piodalan", accountId: BANK, activityId: "a_piodalan", campaignId: "cp_piodalan" });
  add(D, { type: "expense", amount: 3_600_000, date: "2026-07-07", categoryId: c("bangunan"), description: "Perbaikan saluran air & paving jaba sisi", accountId: BANK, activityId: "a_pemeliharaan" });
  add(D, { type: "expense", amount: 3_250_000, date: "2026-02-20", categoryId: c("outlain"), description: "Pembelian sound system pura", accountId: BANK, activityId: "a_operasional" });
  // Duplicate entry + its reversal (shows correction workflow)
  const dup = add(D, { type: "expense", amount: 1_850_000, date: "2026-08-15", categoryId: c("bangunan"), description: "Cat tembok & kayu bale pewaregan", accountId: BANK, activityId: "a_pemeliharaan", notes: "Tercatat dua kali" });
  const rev = add(D, { type: "expense", amount: 1_850_000, date: "2026-08-16", categoryId: c("bangunan"), description: "Koreksi: pembatalan catatan ganda cat tembok", accountId: BANK, activityId: "a_pemeliharaan", reversalOf: dup, notes: "Nota yang sama tercatat dua kali pada 15 Agustus." }, "u_made");
  txs.find((t) => t.id === dup)!.reversedBy = rev;
  // Draft awaiting confirmation
  add(D, { type: "expense", amount: 275_000, date: "2026-10-26", categoryId: c("upakara"), description: "Canang & dupa persiapan Piodalan", accountId: KAS, activityId: "a_piodalan", status: "draft", notes: "Menunggu nota dari pedagang" }, "u_wayan");

  // --- Donations (each verified donation is linked to exactly one income entry) ---
  let dn = 0;
  const donate = (
    templeId: string,
    campaignId: string,
    donorName: string,
    amount: number,
    date: string,
    privacy: DonorPrivacy,
    opts: { status?: Donation["status"]; message?: string; accountId: string; activityId?: string; categoryId: string; channel?: Donation["channel"]; rejectedReason?: string }
  ) => {
    dn++;
    const id = `dn_${String(dn).padStart(4, "0")}`;
    const status = opts.status ?? "verified";
    const d: Donation = {
      id,
      templeId,
      campaignId,
      donorName,
      amount,
      date,
      privacy,
      status,
      message: opts.message,
      channel: opts.channel ?? "transfer",
      createdAt: `${date}T10:00:00`,
      rejectedReason: opts.rejectedReason,
    };
    if (status === "verified") {
      d.verifiedAt = `${date}T16:00:00`;
      d.verifiedBy = "u_ayu";
      d.transactionId = add(templeId, {
        type: "income",
        amount,
        date,
        categoryId: opts.categoryId,
        description: `Dana punia: ${privacy === "public" ? donorName : "Donatur"}`,
        accountId: opts.accountId,
        activityId: opts.activityId,
        campaignId,
        donationId: id,
        source: donorName,
      });
    }
    donations.push(d);
  };

  const pio = { accountId: BANK, activityId: "a_piodalan", categoryId: c("campaign") };
  const pioDonors: [string, number, string, DonorPrivacy, string?][] = [
    ["Keluarga Besar I Ketut Rai", 2_500_000, "2026-09-02", "public", "Semoga Piodalan berjalan lancar."],
    ["Keluarga Wayan Adi", 1_000_000, "2026-09-04", "public"],
    ["I Made Surya", 500_000, "2026-09-06", "public", "Om Swastyastu, suksma."],
    ["Ni Luh Sari", 250_000, "2026-09-09", "public"],
    ["Anonim", 100_000, "2026-09-12", "anonymous"],
    ["I Gede Putra Wirawan", 1_500_000, "2026-09-15", "public"],
    ["Ni Made Ayu Lestari", 750_000, "2026-09-18", "public"],
    ["Banjar Adat Gerung", 3_000_000, "2026-09-21", "public", "Punia dari seluruh krama banjar."],
    ["Donatur Privat", 2_000_000, "2026-09-24", "private"],
    ["I Nyoman Sudarta", 500_000, "2026-09-27", "public"],
    ["Ni Ketut Wardani", 300_000, "2026-09-30", "public"],
    ["Anonim", 1_000_000, "2026-10-02", "anonymous"],
    ["Keluarga I Komang Arya", 1_250_000, "2026-10-06", "public", "Rahajeng Piodalan."],
    ["I Wayan Budiasa", 600_000, "2026-10-09", "public"],
    ["Ni Putu Eka Pratiwi", 200_000, "2026-10-12", "public"],
    ["Donatur Privat", 800_000, "2026-10-14", "private"],
    ["Sekaa Teruna Dharma Kerti", 1_000_000, "2026-10-17", "public", "Dari para yowana."],
    ["I Ketut Suarjana", 400_000, "2026-10-19", "public"],
    ["Anonim", 150_000, "2026-10-21", "anonymous"],
    ["Ni Wayan Rasmini", 350_000, "2026-10-23", "public"],
    ["I Kadek Dwi Antara", 600_000, "2026-10-25", "public"],
  ];
  for (const [name, amt, date, priv, msg] of pioDonors) donate(D, "cp_piodalan", name, amt, date, priv, { ...pio, message: msg });
  // Pending submissions awaiting manual verification
  donate(D, "cp_piodalan", "Ni Kadek Sinta Dewi", 300_000, "2026-10-26", "public", { ...pio, status: "pending", message: "Bukti transfer sudah dikirim via WA." });
  donate(D, "cp_piodalan", "I Komang Juliarta", 1_000_000, "2026-10-26", "anonymous", { ...pio, status: "pending" });
  donate(D, "cp_piodalan", "Keluarga I Gusti Ngurah Oka", 750_000, "2026-10-27", "public", { ...pio, status: "pending", channel: "tunai" });
  donate(D, "cp_piodalan", "Pengirim tidak dikenal", 2_500_000, "2026-10-15", "public", { ...pio, status: "rejected", rejectedReason: "Dana tidak masuk ke rekening pura saat dicek mutasi." });

  const bale = { accountId: BANK, activityId: "a_balepiasan", categoryId: c("campaign") };
  const baleDonors: [string, number, string, DonorPrivacy][] = [
    ["Keluarga Besar Jro Mangku Rena", 5_000_000, "2026-06-03", "public"],
    ["Banjar Adat Gerung", 2_500_000, "2026-06-20", "public"],
    ["Donatur Privat", 2_000_000, "2026-07-08", "private"],
    ["I Putu Agus Mahendra", 1_000_000, "2026-08-12", "public"],
    ["Anonim", 500_000, "2026-08-30", "anonymous"],
    ["Keluarga Ni Nyoman Rai", 1_400_000, "2026-09-19", "public"],
  ];
  for (const [name, amt, date, priv] of baleDonors) donate(D, "cp_balepiasan", name, amt, date, priv, bale);

  const peny = { accountId: BANK, activityId: "a_pemeliharaan", categoryId: c("campaign") };
  const penyDonors: [string, number, string, DonorPrivacy][] = [
    ["Banjar Adat Gerung", 4_000_000, "2026-03-04", "public"],
    ["Keluarga I Wayan Lanus", 2_000_000, "2026-03-15", "public"],
    ["Anonim", 1_350_000, "2026-03-29", "anonymous"],
    ["I Made Surya", 1_000_000, "2026-04-10", "public"],
    ["Donatur Privat", 2_000_000, "2026-04-26", "private"],
  ];
  for (const [name, amt, date, priv] of penyDonors) donate(D, "cp_penyengker", name, amt, date, priv, peny);

  // --- Other temples (smaller ledgers, same rules) ---
  const G = "t_girikencana";
  const g = (k: string) => `c_girikencana_${k}`;
  for (let m = 1; m <= 10; m++) {
    const mm = String(m).padStart(2, "0");
    add(G, { type: "income", amount: 400_000 + m * 15_000, date: `2026-${mm}-06`, categoryId: g("sesari"), description: "Sesari Purnama", accountId: "acc_gk_kas", activityId: "a_gk_operasional" }, "u_made");
    add(G, { type: "expense", amount: 300_000, date: `2026-${mm}-08`, categoryId: g("upakara"), description: "Banten Purnama", accountId: "acc_gk_kas", activityId: "a_gk_operasional" }, "u_made");
    add(G, { type: "expense", amount: 155_000, date: `2026-${mm}-14`, categoryId: g("utilitas"), description: "Listrik pura", accountId: "acc_gk_bank", activityId: "a_gk_operasional" }, "u_made");
  }
  add(G, { type: "expense", amount: 8_750_000, date: "2026-09-02", categoryId: g("bangunan"), description: "Batu paras & ukiran Padmasana tahap 1", accountId: "acc_gk_bank", activityId: "a_gk_padmasana", campaignId: "cp_padmasana" }, "u_made");
  const pad = { accountId: "acc_gk_bank", activityId: "a_gk_padmasana", categoryId: g("campaign") };
  const padDonors: [string, number, string, DonorPrivacy][] = [
    ["Krama Dusun Kebon Bukit", 7_500_000, "2026-05-05", "public"],
    ["Keluarga I Putu Darma Yasa", 3_000_000, "2026-05-20", "public"],
    ["Donatur Privat", 5_000_000, "2026-06-14", "private"],
    ["Anonim", 1_000_000, "2026-07-02", "anonymous"],
    ["I Made Wirata", 2_000_000, "2026-08-09", "public"],
    ["Ni Luh Putu Ariani", 3_000_000, "2026-09-25", "public"],
  ];
  for (const [name, amt, date, priv] of padDonors) donate(G, "cp_padmasana", name, amt, date, priv, pad);
  donate(G, "cp_padmasana", "I Ketut Sumerta", 500_000, "2026-10-26", "public", { ...pad, status: "pending" });

  const ts = { accountId: "acc_ts_bank", categoryId: "c_tamansari_campaign" };
  ([
    ["Krama Cakranegara Barat", 2_500_000, "2026-10-03", "public"],
    ["Keluarga I Wayan Mudana", 1_000_000, "2026-10-08", "public"],
    ["Anonim", 500_000, "2026-10-14", "anonymous"],
    ["Ni Made Suastini", 750_000, "2026-10-20", "public"],
  ] as [string, number, string, DonorPrivacy][]).forEach(([n2, a, d, p]) => donate("t_tamansari", "cp_tamansari", n2, a, d, p, ts));

  const sw = { accountId: "acc_sw_bank", categoryId: "c_sweta_campaign" };
  ([
    ["Pengempon Pura Sweta", 6_000_000, "2026-08-20", "public"],
    ["Donatur Privat", 3_000_000, "2026-09-07", "private"],
    ["I Gede Arimbawa", 1_500_000, "2026-09-30", "public"],
    ["Anonim", 1_000_000, "2026-10-16", "anonymous"],
    ["Ni Kadek Ayu Wulandari", 1_250_000, "2026-10-24", "public"],
  ] as [string, number, string, DonorPrivacy][]).forEach(([n2, a, d, p]) => donate("t_sweta", "cp_sweta", n2, a, d, p, sw));

  add("t_batulumbung", { type: "income", amount: 2_200_000, date: "2026-03-17", categoryId: "c_batulumbung_punia", description: "Punia upacara Melasti", accountId: "acc_bl_bank" }, "u_platform");
  add("t_batulumbung", { type: "expense", amount: 1_650_000, date: "2026-03-18", categoryId: "c_batulumbung_upakara", description: "Banten upacara Melasti", accountId: "acc_bl_bank" }, "u_platform");

  // Attach illustrative (fictional) receipt images to larger expenses
  const shops = ["UD Sari Banten", "Toko Bangunan Sinar Jaya", "CV Karya Mandiri", "Warung Bu Komang", "PLN / PDAM (contoh)"];
  txs.forEach((t, i) => {
    if (t.templeId === D && t.type === "expense" && !t.reversalOf && t.amount >= 400_000 && i % 2 === 0) {
      t.receipt = receiptSvg(shops[i % shops.length], t.description, t.amount, t.date);
      t.receiptName = "nota.svg";
    }
  });

  // Assign sequential human-readable numbers by date
  const sorted = [...txs].sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));
  sorted.forEach((t, i) => (t.number = `TRX-2026-${String(i + 1).padStart(4, "0")}`));

  return { txs, donations, count: txs.length };
}

export function createSeed(): DataState {
  const { txs, donations, count } = buildLedger();
  const accs = accounts.map((a) => ({ ...a }));

  // Opening balances (1 Jan 2026) for Durgandhini are chosen so that the derived
  // balance on the demo date is exactly Rp17.250.000 (cash Rp3.450.000 + bank Rp13.800.000).
  const target: Record<string, number> = { acc_dg_kas: 3_450_000, acc_dg_bank: 13_800_000 };
  for (const a of accs) {
    if (target[a.id] !== undefined) {
      const net = accountBalance({ ...a, openingBalance: 0 }, txs);
      a.openingBalance = target[a.id] - net;
    }
  }

  const categories = temples.flatMap((t) => cats(t.id));
  const base = { transactions: txs, accounts: accs };

  const reports: PublishedReport[] = [];
  const snap = (id: string, templeId: string, title: string, from: string, to: string, publishedAt: string, note?: string) => {
    const s = summarize(base, templeId, { from, to });
    const inRange = txs.filter((t) => t.templeId === templeId && t.date >= from && t.date <= to);
    reports.push({
      id,
      templeId,
      title,
      periodStart: from,
      periodEnd: to,
      publishedAt,
      publishedBy: "u_made",
      snapshot: {
        openingBalance: s.openingBalance,
        income: s.income,
        expense: s.expense,
        closingBalance: s.closingBalance,
        incomeByCategory: byCategory(inRange, categories, "income").map(({ name, amount }) => ({ name, amount })),
        expenseByCategory: byCategory(inRange, categories, "expense").map(({ name, amount }) => ({ name, amount })),
        note,
      },
    });
  };
  snap("rp_q3", "t_durgandhini", "Laporan Keuangan Triwulan III 2026", "2026-07-01", "2026-09-30", "2026-10-03T10:00:00", "Disampaikan pada paruman prajuru 3 Oktober 2026.");
  snap("rp_s1", "t_durgandhini", "Laporan Keuangan Semester I 2026", "2026-01-01", "2026-06-30", "2026-07-05T10:00:00");
  snap("rp_gk_s1", "t_girikencana", "Laporan Keuangan Semester I 2026", "2026-01-01", "2026-06-30", "2026-07-10T10:00:00");
  snap("rp_sw_q3", "t_sweta", "Laporan Triwulan III 2026", "2026-07-01", "2026-09-30", "2026-10-05T10:00:00");

  const notifications: AppNotification[] = [
    { id: "n1", templeId: "t_durgandhini", kind: "donation_pending", title: "Donasi baru menunggu verifikasi", body: "Keluarga I Gusti Ngurah Oka — Rp750.000 untuk Dana Punia Piodalan November 2026.", date: "2026-10-27T07:42:00", read: false, href: "/app/campaign/cp_piodalan?tab=verifikasi" },
    { id: "n2", templeId: "t_durgandhini", kind: "donation_pending", title: "2 donasi lain menunggu verifikasi", body: "Ni Kadek Sinta Dewi dan I Komang Juliarta mengirim bukti transfer.", date: "2026-10-26T19:10:00", read: false, href: "/app/campaign/cp_piodalan?tab=verifikasi" },
    { id: "n3", templeId: "t_durgandhini", kind: "tx_approval", title: "Transaksi menunggu persetujuan", body: "Draf pengeluaran \"Canang & dupa persiapan Piodalan\" Rp275.000 dibuat oleh I Wayan Sudiarta.", date: "2026-10-26T15:20:00", read: false, href: "/app/transaksi?status=draft" },
    { id: "n4", templeId: "t_durgandhini", kind: "campaign_ending", title: "Campaign segera berakhir", body: "Dana Punia Piodalan November 2026 berakhir 20 November. Masih kurang dari target.", date: "2026-10-25T08:00:00", read: true, href: "/app/campaign/cp_piodalan" },
    { id: "n5", templeId: "t_durgandhini", kind: "report_ready", title: "Laporan Triwulan III siap", body: "Laporan Keuangan Triwulan III 2026 telah dipublikasikan ke halaman publik pura.", date: "2026-10-03T10:00:00", read: true, href: "/app/laporan" },
    { id: "n6", templeId: "t_durgandhini", kind: "target_reached", title: "Target campaign tercapai 🎉", body: "Perbaikan Penyengker Pura mencapai 103% dari target.", date: "2026-04-26T17:00:00", read: true, href: "/app/campaign/cp_penyengker" },
    { id: "n7", templeId: "t_girikencana", kind: "donation_pending", title: "Donasi baru menunggu verifikasi", body: "I Ketut Sumerta — Rp500.000 untuk Renovasi Padmasana.", date: "2026-10-26T12:00:00", read: false, href: "/app/campaign/cp_padmasana?tab=verifikasi" },
  ];

  const audit: AuditEntry[] = [
    { id: "au1", templeId: "t_durgandhini", actorId: "u_made", actorName: "I Made Wirata", action: "Membuat koreksi", entity: "transaction", entityId: "tx_dup", detail: "Membatalkan catatan ganda \"Cat tembok & kayu bale pewaregan\" Rp1.850.000 melalui entri koreksi.", at: "2026-08-16T10:05:00" },
    { id: "au2", templeId: "t_durgandhini", actorId: "u_made", actorName: "I Made Wirata", action: "Mempublikasikan laporan", entity: "report", entityId: "rp_q3", detail: "Laporan Keuangan Triwulan III 2026", at: "2026-10-03T10:00:00" },
    { id: "au3", templeId: "t_durgandhini", actorId: "u_ayu", actorName: "Ni Ketut Ayu Rahayu", action: "Memverifikasi donasi", entity: "donation", detail: "I Kadek Dwi Antara — Rp600.000 (Dana Punia Piodalan November 2026)", at: "2026-10-25T16:00:00" },
    { id: "au4", templeId: "t_durgandhini", actorId: "u_ayu", actorName: "Ni Ketut Ayu Rahayu", action: "Menolak donasi", entity: "donation", detail: "Pengirim tidak dikenal — Rp2.500.000: dana tidak masuk ke rekening pura.", at: "2026-10-15T14:30:00" },
    { id: "au5", templeId: "t_durgandhini", actorId: "u_ayu", actorName: "Ni Ketut Ayu Rahayu", action: "Mencatat pengeluaran", entity: "transaction", detail: "Bahan banten Piodalan tahap 1 — Rp2.350.000", at: "2026-10-20T11:00:00" },
    { id: "au6", templeId: "t_durgandhini", actorId: "u_wayan", actorName: "I Wayan Sudiarta", action: "Membuat draf transaksi", entity: "transaction", detail: "Canang & dupa persiapan Piodalan — Rp275.000", at: "2026-10-26T15:20:00" },
    { id: "au7", templeId: "t_durgandhini", actorId: "u_made", actorName: "I Made Wirata", action: "Membuat campaign", entity: "campaign", entityId: "cp_galungan_draft", detail: "Draf: Punia Hari Raya Galungan 2027", at: "2026-10-18T09:00:00" },
  ];
  // Point the correction audit entry at the real ids
  const dupTx = txs.find((t) => t.reversedBy);
  if (dupTx) audit[0].entityId = dupTx.reversedBy;

  return {
    version: SEED_VERSION,
    users: users.map((u) => ({ ...u })),
    memberships: memberships.map((m) => ({ ...m })),
    temples: temples.map((t) => ({ ...t, transparency: { ...t.transparency }, branding: { ...t.branding } })),
    accounts: accs,
    categories,
    activities: activities.map((a) => ({ ...a })),
    transactions: txs,
    campaigns: campaigns.map((c) => ({ ...c, updates: [...c.updates] })),
    donations,
    reports,
    notifications,
    audit,
    counters: { tx: count },
    resetRequests: [],
  };
}

export function categoriesFor(templeId: string) {
  return cats(templeId);
}

/** Generates a simple fictional receipt image (SVG data URL) for seed data. */
function receiptSvg(shop: string, item: string, amount: number, date: string) {
  const amt = "Rp" + amount.toLocaleString("id-ID");
  const [y, m, d] = date.split("-");
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><rect width="360" height="480" fill="#fffdf7"/><rect x="12" y="12" width="336" height="456" fill="none" stroke="#e5dccb" stroke-dasharray="6 4"/><text x="180" y="60" font-family="monospace" font-size="18" font-weight="bold" text-anchor="middle" fill="#333">${esc(shop)}</text><text x="180" y="84" font-family="monospace" font-size="12" text-anchor="middle" fill="#777">NOTA CONTOH (FIKTIF)</text><line x1="36" y1="104" x2="324" y2="104" stroke="#bbb" stroke-dasharray="4 3"/><text x="36" y="132" font-family="monospace" font-size="13" fill="#555">Tgl: ${d}/${m}/${y}</text><text x="36" y="170" font-family="monospace" font-size="13" fill="#333">${esc(item.slice(0, 34))}</text><text x="36" y="190" font-family="monospace" font-size="13" fill="#333">${esc(item.slice(34, 68))}</text><line x1="36" y1="320" x2="324" y2="320" stroke="#bbb" stroke-dasharray="4 3"/><text x="36" y="352" font-family="monospace" font-size="16" font-weight="bold" fill="#333">TOTAL</text><text x="324" y="352" font-family="monospace" font-size="16" font-weight="bold" text-anchor="end" fill="#333">${amt}</text><text x="180" y="420" font-family="monospace" font-size="12" text-anchor="middle" fill="#999">Terima kasih - Suksma</text><circle cx="270" cy="400" r="34" fill="none" stroke="#c0392b" stroke-width="2" opacity=".5"/><text x="270" y="405" font-family="monospace" font-size="11" text-anchor="middle" fill="#c0392b" opacity=".6">LUNAS</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
