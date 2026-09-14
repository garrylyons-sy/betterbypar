import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interclub Snooker",
  description: "Mobile-first league management for amateur interclub snooker.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/app-icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#06120d",
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
      </body>
    </html>
  );
}
