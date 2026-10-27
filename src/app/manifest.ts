import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PURA — Kas & Dana Punia Pura",
    short_name: "PURA",
    description: "Pencatatan kas, dana punia, dan laporan keuangan pura yang sederhana dan transparan.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF9F6",
    theme_color: "#064E3B",
    lang: "id",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Catat Pengeluaran", url: "/app/transaksi/baru?type=expense", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Catat Pemasukan", url: "/app/transaksi/baru?type=income", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
