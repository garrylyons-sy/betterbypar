import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

function endOfJuneThisYear() {
  return `${new Date().getFullYear()}-06-30`;
}

export async function POST() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const result = await withTransaction(async (client) => {
      const admin = await client.query(
        "select 1 from public.app_operator where person_id = $1 and active = true limit 1",
        [user.personId]
      );
      if (!admin.rowCount) throw new Error("Administrator access is required.");

      const club = await client.query<{ id: string }>(
        "select id from public.club where name = 'Castle Golf Club' and active = true limit 1"
      );
      const clubId = club.rows[0]?.id;
      if (!clubId) throw new Error("Castle Golf Club was not found.");

      const playerResult = await client.query<{ club_membership_id: string; player_name: string }>(
        `select club_membership_id, player_name
         from (
           select distinct
             cm.id as club_membership_id,
             concat_ws(' ', p.first_name, p.last_name) as player_name
           from public.club_membership cm
           join public.person p on p.id = cm.person_id and p.active = true
           join public.person_team_role ptr on ptr.club_membership_id = cm.id and ptr.active = true
           where cm.club_id = $1
             and cm.active = true
             and public.is_golf_player(cm.person_id, cm.club_id)
             and cm.person_id <> $2
             and ptr.role = 'Player'
             and ptr.team_name like 'Castle %'
         ) castle_players
         order by random()
         limit 8`,
        [clubId, user.personId]
      );

      if (playerResult.rows.length < 8) {
        throw new Error(`Only found ${playerResult.rows.length} Castle players excluding you.`);
      }

      const randomNumber = Math.floor(1000 + Math.random() * 9000);
      const competitionName = `AUTO GENERATED COMPETITION- ${randomNumber}`;
      const entryClosesAt = endOfJuneThisYear();
      const competition = await client.query<{ id: string }>(
        `insert into public.competition (club_id, managed_by_platform, name, competition_type, entry_closes_at, rules, status, created_by)
         values ($1, false, $2, 'Scratch', $3::date, 'Auto-generated test competition with 8 Castle entrants.', 'Open', $4)
         returning id`,
        [clubId, competitionName, entryClosesAt, user.personId]
      );
      const competitionId = competition.rows[0].id;

      for (const player of playerResult.rows) {
        await client.query(
          `insert into public.competition_entry (competition_id, club_membership_id, entered_by, status)
           values ($1, $2, $3, 'Entered')`,
          [competitionId, player.club_membership_id, user.personId]
        );
      }

      return {
        competitionId,
        competitionName,
        entryClosesAt,
        players: playerResult.rows.map((player) => player.player_name)
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create auto competition." },
      { status: 400 }
    );
  }
}
