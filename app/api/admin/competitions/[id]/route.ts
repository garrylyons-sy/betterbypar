import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

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

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, administrator } = await requireAdministrator();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!administrator) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

    const { id } = await params;
    const deleted = await dbQuery<{ name: string }>(
      "delete from public.competition where id = $1 returning name",
      [id]
    );
    const competition = deleted.rows[0];
    if (!competition) return NextResponse.json({ error: "Competition not found." }, { status: 404 });

    return NextResponse.json({ ok: true, name: competition.name });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete competition." },
      { status: 400 }
    );
  }
}
