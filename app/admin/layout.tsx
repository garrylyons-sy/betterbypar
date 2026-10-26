import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Better By Par",
  icons: {
    icon: "/brand/admin-favicon.ico",
    shortcut: "/brand/admin-favicon.ico",
    apple: "/admin-icon-180.png"
  }
};

export default function AdminLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
