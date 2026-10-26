import type { Metadata } from "next";

import { MaintenancePage } from "@/components/maintenance-page";

export const metadata: Metadata = {
  icons: {icon: "/brand/maintenance-favicon.ico", shortcut: "/brand/maintenance-favicon.ico", apple: "/brand/maintenance-180.png"},
  title: "Maintenance — Better By Par",
  description: "The platform is temporarily unavailable while maintenance is completed."
};

export default function MaintenanceRoute() {
  return <MaintenancePage />;
}
