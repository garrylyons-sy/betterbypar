import type { Metadata } from "next";

import { MaintenancePage } from "@/components/maintenance-page";

export const metadata: Metadata = {
  title: "Down for maintenance | Interclub Snooker",
  description: "Interclub Snooker is temporarily unavailable while maintenance is completed."
};

export default function MaintenanceRoute() {
  return <MaintenancePage />;
}
