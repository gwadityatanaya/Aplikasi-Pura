/**
 * Shown on every page of the DEMO deployment (NEXT_PUBLIC_DEMO_MODE="true"), so nobody mistakes
 * the fictional data for a real temple. The pilot deployment leaves this variable empty.
 */
export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;
  return (
    <div role="note" className="bg-amber-400 px-4 py-2 text-center text-sm font-bold text-charcoal">
      SITUS DEMO — semua pura, nama, dan nomor rekening di sini FIKTIF. Jangan mentransfer uang.
    </div>
  );
}
