import type { Metadata, Viewport } from "next";
import { DemoBanner } from "@/components/shared/demo-banner";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "PURA — Kas & Dana Punia Pura yang Transparan", template: "%s · PURA" },
  description: "PURA: pencatatan kas, dana punia, dan laporan keuangan pura yang sederhana dan transparan.",
  applicationName: "PURA",
  appleWebApp: { capable: true, title: "PURA", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#064E3B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-dvh font-sans">
        <DemoBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
