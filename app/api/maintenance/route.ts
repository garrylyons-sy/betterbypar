import { NextResponse } from "next/server";

import { loadMaintenanceMode } from "@/lib/server/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const maintenance = await loadMaintenanceMode();
  return NextResponse.json(
    { enabled: maintenance.enabled },
    { headers: { "Cache-Control": "no-store" } }
  );
}
