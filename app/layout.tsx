import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

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

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
