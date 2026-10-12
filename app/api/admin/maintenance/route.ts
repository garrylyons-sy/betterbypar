import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { isPlatformOperator, loadMaintenanceMode, setMaintenanceMode } from "@/lib/server/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requirePlatformAdministrator() {
  const user = await currentUser();
  if (!user) return { user: null, allowed: false };
  return { user, allowed: await isPlatformOperator(user.personId) };
}

export async function GET() {
  const { user, allowed } = await requirePlatformAdministrator();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  return NextResponse.json({ maintenance: await loadMaintenanceMode() });
}

export async function PATCH(request: Request) {
  try {
    const { user, allowed } = await requirePlatformAdministrator();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!allowed) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });

    const body = await request.json();
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "Maintenance status must be true or false." }, { status: 400 });
    }

    const maintenance = await setMaintenanceMode(body.enabled, user.personId);
    return NextResponse.json({ maintenance });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update maintenance mode." },
      { status: 500 }
    );
  }
}
