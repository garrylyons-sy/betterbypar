import { NextRequest, NextResponse } from "next/server";

import { maintenanceRequestDecision } from "@/lib/maintenance-policy.mjs";
import { loadMaintenanceMode, maintenanceSessionAccess } from "@/lib/server/maintenance";

export async function middleware(request: NextRequest) {
  const maintenance = await loadMaintenanceMode().catch(() => ({ enabled: false, updatedAt: null }));
  const access = maintenance.enabled
    ? await maintenanceSessionAccess(request.cookies.get("is_session")?.value).catch(() => ({ hasSession: false, platformAdmin: false }))
    : { hasSession: false, platformAdmin: false };
  const decision = maintenanceRequestDecision({
    pathname: request.nextUrl.pathname,
    maintenanceEnabled: maintenance.enabled,
    ...access
  });

  if (decision === "block-api") {
    return NextResponse.json(
      { error: "Interclub Snooker is down for maintenance." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (decision === "show-maintenance") {
    const response = NextResponse.rewrite(new URL("/maintenance", request.url));
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|icons|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|webmanifest)$).*)"],
  runtime: "nodejs"
};
