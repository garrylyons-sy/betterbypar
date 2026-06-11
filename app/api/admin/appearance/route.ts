import { NextResponse } from "next/server";

import { appearanceRoles } from "@/lib/appearance";
import { saveRoleAppearance } from "@/lib/server/appearance";
import { currentUser } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";
import type { AppearanceMenuId, AppearancePanelId, Role } from "@/lib/types";

export const runtime = "nodejs";

async function requireAdministrator() {
  const user = await currentUser();
  if (!user) return { user: null, administrator: false };
  const { rowCount } = await dbQuery(
    "select 1 from public.app_operator where person_id = $1 and active = true limit 1",
    [user.personId]
  );
  return { user, administrator: Boolean(rowCount) };
}

export async function POST(request: Request) {
  try {
    const { user, administrator } = await requireAdministrator();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!administrator) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

    const body = await request.json();
    const role = body.role as Role;
    if (!appearanceRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    const panels = Array.isArray(body.panels) ? body.panels as AppearancePanelId[] : [];
    const menuItems = Array.isArray(body.menuItems) ? body.menuItems as AppearanceMenuId[] : [];
    const appearance = await saveRoleAppearance(role, panels, menuItems, user.personId);

    return NextResponse.json({ appearance });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save appearance." },
      { status: 500 }
    );
  }
}
