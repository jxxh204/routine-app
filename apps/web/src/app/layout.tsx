import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AntdProvider } from "@/components/antd-provider";
import { BottomNav } from "@/components/bottom-nav";
import { QueryProvider } from "@/components/query-provider";
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
  title: "루틴",
  description: "일상을 루틴으로 만들어보세요",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "루틴",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AntdProvider>
          <QueryProvider>
            {children}
            <BottomNav />
          </QueryProvider>
        </AntdProvider>
      </body>
    </html>
  );
}
