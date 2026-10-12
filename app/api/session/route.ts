import { NextResponse } from "next/server";

import { currentUser, loadSessionPayload, testUserFromEmail } from "@/lib/server/auth";
import { isPlatformOperator, loadMaintenanceMode } from "@/lib/server/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const testUser = await testUserFromEmail(url.searchParams.get("testUser"));
    const user = testUser ?? await currentUser();
    if (!user) return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });

    const maintenance = await loadMaintenanceMode();
    if (maintenance.enabled && !await isPlatformOperator(user.personId)) {
      return NextResponse.json(
        { authenticated: false, maintenance: true, error: "Interclub Snooker is down for maintenance." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(await loadSessionPayload(user), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { authenticated: false, error: error instanceof Error ? error.message : "Session unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
