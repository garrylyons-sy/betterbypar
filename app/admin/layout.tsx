import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin - Interclub Snooker",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico"
  }
};

export default function AdminLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
