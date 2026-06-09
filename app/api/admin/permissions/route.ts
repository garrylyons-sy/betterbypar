import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

async function assertOperator() {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated.");
  const { rowCount } = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
  if (!rowCount) throw new Error("Operator access is required.");
}

export async function POST(request: Request) {
  try {
    await assertOperator();
    const body = await request.json();
    const personId = String(body.personId ?? "").trim();
    const teamId = String(body.teamId ?? "").trim();
    const role = String(body.role ?? "Player");
    const active = Boolean(body.active);

    if (!personId || !teamId) {
      return NextResponse.json({ error: "Person and team are required." }, { status: 400 });
    }

    await dbQuery(
      `insert into public.team_membership (person_id, team_id, role, active)
       values ($1, $2, $3, $4)
       on conflict (team_id, person_id, role) do update
       set active = excluded.active`,
      [personId, teamId, role, active]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save permission." },
      { status: 400 }
    );
  }
}
