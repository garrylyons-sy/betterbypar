import { NextResponse } from "next/server";

import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const teamId = String(body.teamId ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!name || !email || !teamId) {
      return NextResponse.json({ error: "Name, email and team are required." }, { status: 400 });
    }

    const teamResult = await dbQuery<{ club_id: string }>(
      "select club_id from public.team where id = $1 and active = true limit 1",
      [teamId]
    );
    const team = teamResult.rows[0];
    if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });

    await dbQuery(
      `insert into public.invitation_request (requested_person_name, email, club_id, team_id, requested_role, message)
       values ($1, $2, $3, $4, 'Player', $5)`,
      [name, email, team.club_id, teamId, message || null]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed." },
      { status: 500 }
    );
  }
}
