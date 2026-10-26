import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { SettingsSync } from "@/components/SettingsSync";
import { TermTips } from "@/components/TermTips";
import { THEME_SCRIPT } from "@/lib/themeScript";
import "./globals.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Variable fonts (Latin subset from Google Fonts) kept in the repo, so the build never fetches them.
const urbanist = localFont({ src: "./fonts/Urbanist-latin.woff2", weight: "300 800", variable: "--font-urbanist", display: "swap" });
const jetbrainsMono = localFont({ src: "./fonts/JetBrainsMono-latin.woff2", weight: "400 500", variable: "--font-jetbrains-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Bytewise",
  description: "Short, interactive lessons on software engineering: Java, databases, operating systems, networking and architecture.",
  icons: {
    icon: [
      { url: `${BASE}/icon.svg`, type: "image/svg+xml" },
      { url: `${BASE}/icon-192.png`, type: "image/png", sizes: "192x192" },
    ],
    // iOS ignores SVG here; it needs a full-bleed PNG and rounds the corners itself.
    apple: [{ url: `${BASE}/apple-touch-icon.png`, sizes: "180x180" }],
  },
  manifest: `${BASE}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: "Bytewise", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efeef1" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${urbanist.variable} ${jetbrainsMono.variable}`}>
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
