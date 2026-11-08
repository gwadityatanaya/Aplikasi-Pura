// A simple check for public texts (closing reason, rejection reason): no email addresses, phone
// numbers or account numbers. It cannot recognise names — the form also warns people not to
// write them.
export function personalDataIn(text: string): string | null {
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text)) return "alamat email";
  const digits = text.match(/[\d][\d\s.\-]{6,}[\d]/g)?.map((d) => d.replace(/\D/g, "")) ?? [];
  if (digits.some((d) => d.length >= 8)) return "nomor HP atau nomor rekening";
  return null;
}
