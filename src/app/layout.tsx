import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "租金行情查詢 | 全台租金資料庫",
  description:
    "免費查詢全台灣各縣市、各區域的租金行情，包含套房、雅房、整層住家的中位數租金、均價、租金趨勢分析。資料來源：內政部實價登錄。",
  keywords: [
    "租金查詢",
    "租金行情",
    "實價登錄",
    "租屋",
    "台北租金",
    "租金資料庫",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🏠</span>
              <span className="font-bold text-xl text-gray-800">
                租金行情查詢
              </span>
            </Link>
            <div className="text-sm text-gray-500">
              資料來源：內政部實價登錄
            </div>
          </div>
        </nav>
        <main className="min-h-screen bg-gray-50">{children}</main>
        <footer className="bg-white border-t border-gray-200 py-8">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
            <p>
              租金行情查詢工具 — 資料來源為內政部實價登錄公開資料
            </p>
            <p className="mt-1">
              本工具僅提供行情參考，實際租金以市場為準
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
