// "Ajukan pendaftaran" — shared by the public form and the Back Office.

export type RegistrationStatus = "baru" | "verifikasi" | "disetujui" | "ditolak";
export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  baru: "Baru",
  verifikasi: "Sedang diverifikasi",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
};
/** At most this many requests per device/network per day (anti-spam). */
export const REGISTRATION_PER_DAY = 3;

export interface RegistrationRequest {
  id: string;
  banjarName: string;
  province: string;
  regency: string;
  district: string;
  village: string;
  provinceCode?: string;
  regencyCode?: string;
  districtCode?: string;
  villageCode?: string;
  templeName: string;
  applicantName: string;
  applicantPosition: string;
  whatsapp: string;
  googleEmail: string;
  referrerName: string;
  referrerContact: string;
  reason: string;
  consentAt: string;
  status: RegistrationStatus;
  internalNote: string;
  convertedBanjarId?: string;
  convertedTempleId?: string;
  createdAt: string;
  updatedAt: string;
}
