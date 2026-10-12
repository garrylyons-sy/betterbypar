import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { PwaRegister } from "@/components/pwa-register";
import { loadMaintenanceMode } from "@/lib/server/maintenance";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.interclubsnooker.com"),
  title: "Interclub Snooker",
  description: "Mobile-first league management for amateur interclub snooker.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Interclub Snooker",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: "/favicon-normal.ico",
    shortcut: "/favicon-normal.ico",
    apple: "/icons/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#10233f",
  width: "device-width",
  initialScale: 1
};

export default async function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = (await headers()).get("x-interclub-pathname") || "/";
  const maintenance = await loadMaintenanceMode().catch(() => ({ enabled: false, updatedAt: null }));
  const initialEnabled = pathname.startsWith("/admin") ? false : maintenance.enabled;

  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <MaintenanceGate initialEnabled={initialEnabled}>{children}</MaintenanceGate>
        <PwaRegister />
      </body>
    </html>
  );
}
