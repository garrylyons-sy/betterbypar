import {localDemoEnabled} from "@/lib/local-demo.mjs";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./club-theme.css";
import {ClubThemeProvider} from "@/components/club-theme-provider";
import { SystemSettingsProvider } from "@/components/system-settings-provider";
import { PwaRegister } from "@/components/pwa-register";
import { deploymentAppVersion } from "@/lib/app-version.mjs";

export const metadata: Metadata = {
  title: "Better By Par",
  description: "Your club, lessons and player community, all together.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Better By Par",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#0a2722",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const deploymentVersion = deploymentAppVersion();
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {localDemoEnabled() ? <aside className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950">Local demo · sample data · <a className="underline" href="/demo">Switch demo user</a></aside> : null}
        <ClubThemeProvider><SystemSettingsProvider>{children}</SystemSettingsProvider></ClubThemeProvider>
        <PwaRegister deploymentVersion={deploymentVersion} />
      </body>
    </html>
  );
}
