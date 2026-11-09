import type { Metadata, Viewport } from "next";
import "./globals.css";
import Shell from "@/components/Shell";
import PwaManager from "@/components/PwaManager";

export const metadata: Metadata = {
  title: "AnMart - Quản lý Minimart",
  description: "Công cụ hỗ trợ minimart - Đếm tiền & In tem giá",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AnMart",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full">
        <Shell>{children}</Shell>
        <PwaManager />
      </body>
    </html>
  );
}
