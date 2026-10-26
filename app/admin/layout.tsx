import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Better By Par",
  icons: {
    icon: "/brand/admin-favicon.ico?v=bbp-blue-1",
    shortcut: "/brand/admin-favicon.ico?v=bbp-blue-1",
    apple: "/admin-icon-180.png?v=bbp-blue-1"
  }
};

export default function AdminLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
