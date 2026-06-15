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
         values ($1, false, $2, 'Scratch', $3::date, 'Auto-generated test competition with 8 Castle entrants.', 'Drawn', $4)
         returning id`,
        [clubId, competitionName, entryClosesAt, user.personId]
      );
      const competitionId = competition.rows[0].id;

      const roundDates = [
        { name: "Quarter Final", frames: 1, date: `${new Date().getFullYear()}-07-14` },
        { name: "Semi Final", frames: 1, date: `${new Date().getFullYear()}-07-31` },
        { name: "Final", frames: 1, date: `${new Date().getFullYear()}-08-14` }
      ];
      for (let index = 0; index < roundDates.length; index += 1) {
        const round = roundDates[index];
        await client.query(
          `insert into public.competition_round (competition_id, round_number, name, frames_to_play, play_by_date)
           values ($1, $2, $3, $4, $5::date)`,
          [competitionId, index + 1, round.name, round.frames, round.date]
        );
      }

      for (const player of playerResult.rows) {
        await client.query(
          `insert into public.competition_entry (competition_id, club_membership_id, entered_by, status)
           values ($1, $2, $3, 'Entered')`,
          [competitionId, player.club_membership_id, user.personId]
        );
      }

      const firstRound = await client.query<{ id: string }>(
        `select id
         from public.competition_round
         where competition_id = $1
           and round_number = 1
         limit 1`,
        [competitionId]
      );
      const shuffledPlayers = [...playerResult.rows].sort(() => Math.random() - 0.5);
      for (let index = 0; index < shuffledPlayers.length; index += 2) {
        const player1 = shuffledPlayers[index];
        const player2 = shuffledPlayers[index + 1];
        const entryResult = await client.query<{ entry_id: string }>(
          `select ce.id as entry_id
           from public.competition_entry ce
           where ce.competition_id = $1
             and ce.club_membership_id in ($2, $3)
           order by case when ce.club_membership_id = $2 then 1 else 2 end`,
          [competitionId, player1.club_membership_id, player2.club_membership_id]
        );
        await client.query(
          `insert into public.competition_match (competition_round_id, match_number, player_1_entry_id, player_2_entry_id, status)
           values ($1, $2, $3, $4, 'Scheduled')`,
          [firstRound.rows[0].id, Math.floor(index / 2) + 1, entryResult.rows[0].entry_id, entryResult.rows[1].entry_id]
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
