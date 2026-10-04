import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SettingsSync } from "@/components/SettingsSync";
import { THEME_SCRIPT } from "@/lib/themeScript";
import "./globals.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

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
    { media: "(prefers-color-scheme: light)", color: "#f2f3f1" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applied before the first paint, so a dark-mode visit never flashes white. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <SettingsSync />
        {children}
      </body>
    </html>
  );
}
