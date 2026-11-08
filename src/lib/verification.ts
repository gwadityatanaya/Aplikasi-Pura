/** The four checklist items (shared by the Back Office screen and the server). */
export interface VerificationChecks {
  referenceContactedAt: string | null;
  videoCallAt: string | null;
  accountCheckedAt: string | null;
  accountHolderType: string | null;
  trialStart: string | null;
}

/** How far the checklist is: reference, video call, account in the name of the pura/banjar, trial. */
export function verificationProgress(v?: VerificationChecks | null) {
  if (!v) return { done: 0, total: 4 };
  const done = [v.referenceContactedAt, v.videoCallAt, v.accountCheckedAt && v.accountHolderType !== "lain", v.trialStart].filter(Boolean).length;
  return { done, total: 4 };
}
