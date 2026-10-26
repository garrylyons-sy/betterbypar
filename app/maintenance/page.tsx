import type { Metadata } from "next";

import { MaintenancePage } from "@/components/maintenance-page";

export const metadata: Metadata = {
  icons: {icon: "/brand/maintenance-favicon.ico?v=bbp-blue-1", shortcut: "/brand/maintenance-favicon.ico?v=bbp-blue-1", apple: "/brand/maintenance-180.png?v=bbp-blue-1"},
  title: "Maintenance — Better By Par",
  description: "The platform is temporarily unavailable while maintenance is completed."
};

export default function MaintenanceRoute() {
  return <MaintenancePage />;
}
