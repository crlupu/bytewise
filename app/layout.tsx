import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import { SettingsSync } from "@/components/SettingsSync";
import { TermTips } from "@/components/TermTips";
import { THEME_SCRIPT } from "@/lib/themeScript";
import "./globals.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const interTight = Inter_Tight({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"], variable: "--font-inter-tight", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Bytewise",
  description: "Short, interactive lessons on software engineering: Java, databases, operating systems, networking and architecture.",
  icons: { icon: [{ url: `${BASE}/icon.svg`, type: "image/svg+xml" }], apple: [{ url: `${BASE}/icon.svg` }] },
  appleWebApp: { capable: true, title: "Bytewise", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#050605" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${interTight.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Applied before the first paint, so a dark-mode visit never flashes white. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <SettingsSync />
        {children}
        <TermTips />
      </body>
    </html>
  );
}
