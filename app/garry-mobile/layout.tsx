import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Garry Mobile"
};

export default function GarryMobileLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
