import { NextResponse } from "next/server";

import { createToken, currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

async function assertOperator() {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated.");
  const { rowCount } = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
  if (!rowCount) throw new Error("Operator access is required.");
  return user;
}

export async function POST(request: Request) {
  try {
    const operator = await assertOperator();
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const teamId = String(body.teamId ?? "").trim();
    const role = String(body.role ?? "Player");
    const expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);

    if (!email || !name || !teamId) {
      return NextResponse.json({ error: "Name, email and team are required." }, { status: 400 });
    }

    const code = `IS-${createToken(8).toUpperCase()}`;
    const invitation = await withTransaction(async (client) => {
      const clubResult = await client.query("select club_id from public.team where id = $1 limit 1", [teamId]);
      const clubId = clubResult.rows[0]?.club_id;
      if (!clubId) throw new Error("Team not found.");

      const invitationResult = await client.query(
        `insert into public.invitation (email, invitation_code, invited_person_name, invited_club_id, invited_role, expires_at, status, created_by)
         values ($1, $2, $3, $4, $5, $6, 'Pending', $7)
         returning id, invitation_code`,
        [email, code, name, clubId, role, expiresAt.toISOString(), operator.personId]
      );

      await client.query(
        "insert into public.invitation_membership (invitation_id, team_id, role) values ($1, $2, $3)",
        [invitationResult.rows[0].id, teamId, role]
      );

      return invitationResult.rows[0];
    });

    return NextResponse.json({ ok: true, invitation_code: invitation.invitation_code });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create invite." },
      { status: 400 }
    );
  }
}
