import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

async function requireTeamSettingsAccess() {
  const user = await currentUser();
  if (!user) return { user: null, platformAdmin: false, clubIds: [] as string[] };
  const [operator, clubs] = await Promise.all([
    dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]),
    dbQuery<{ club_id: string }>(
      `select club_id from public.club_admin where person_id = $1 and active = true
       union
       select club_id from public.club_membership where person_id = $1 and active = true and is_club_admin = true`,
      [user.personId]
    )
  ]);
  return { user, platformAdmin: Boolean(operator.rowCount), clubIds: clubs.rows.map((row) => row.club_id) };
}

export async function PATCH(request: Request) {
  try {
    const access = await requireTeamSettingsAccess();
    if (!access.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const teamId = String(body.teamId ?? "").trim();
    if (!teamId) return NextResponse.json({ error: "Team is required." }, { status: 400 });
    const allowUnlimitedLowerTeamPlayers = body.allowUnlimitedLowerTeamPlayers === true;

    const team = await withTransaction(async (client) => {
      const existingResult = await client.query<{
        id: string;
        club_id: string;
        name: string;
        allow_unlimited_lower_team_players: boolean;
      }>(
        `select id::text, club_id::text, name, allow_unlimited_lower_team_players
         from public.team
         where id = $1
         for update`,
        [teamId]
      );
      const existing = existingResult.rows[0];
      if (!existing) throw new Error("Team was not found.");
      if (!access.platformAdmin && !access.clubIds.includes(existing.club_id)) {
        const forbidden = new Error("Club administrator access is required for this team.");
        Object.assign(forbidden, { status: 403 });
        throw forbidden;
      }

      const updated = await client.query<{
        id: string;
        name: string;
        allow_unlimited_lower_team_players: boolean;
      }>(
        `update public.team
         set allow_unlimited_lower_team_players = $2
         where id = $1
         returning id::text, name, allow_unlimited_lower_team_players`,
        [teamId, allowUnlimitedLowerTeamPlayers]
      );

      if (existing.allow_unlimited_lower_team_players !== allowUnlimitedLowerTeamPlayers) {
        await client.query(
          `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
           values ($1, 'Page Visit', '/admin/clubs', 'Updated team player eligibility',
             jsonb_build_object('team_id', $2::text, 'team_name', $3, 'allow_unlimited_lower_team_players', $4::boolean))`,
          [access.user!.personId, teamId, existing.name, allowUnlimitedLowerTeamPlayers]
        );
      }
      return updated.rows[0];
    });

    return NextResponse.json({
      team: {
        teamId: team.id,
        teamName: team.name,
        allowUnlimitedLowerTeamPlayers: team.allow_unlimited_lower_team_players
      }
    });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && error.status === 403 ? 403 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Team setting could not be saved." }, { status });
  }
}
