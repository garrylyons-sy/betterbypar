import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { loadCompetitionDetail } from "@/lib/server/competitions";
import { withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; matchId: string }> }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { id, matchId } = await params;
    const body = await request.json();
    const player1Score = Number(body.player1Score);
    const player2Score = Number(body.player2Score);
    if (!Number.isInteger(player1Score) || !Number.isInteger(player2Score) || player1Score < 0 || player2Score < 0 || player1Score === player2Score) {
      return NextResponse.json({ error: "Enter a valid winning score." }, { status: 400 });
    }

    await withTransaction(async (client) => {
      const matchResult = await client.query<{
        id: string;
        competition_round_id: string;
        match_number: number;
        player_1_entry_id: string | null;
        player_2_entry_id: string | null;
        status: string;
      }>(
        `select
           m.id,
           m.competition_round_id,
           m.match_number,
           m.player_1_entry_id,
           m.player_2_entry_id,
           m.status
         from public.competition_match m
         join public.competition_round r on r.id = m.competition_round_id
         where m.id = $1
           and r.competition_id = $2
         for update of m`,
        [matchId, id]
      );
      const match = matchResult.rows[0];
      if (!match || !match.player_1_entry_id || !match.player_2_entry_id) throw new Error("Match not found.");

      const playerResult = await client.query<{
        player_1_person_id: string | null;
        player_2_person_id: string | null;
        round_number: number;
      }>(
        `select
           r.round_number,
           cm1.person_id as player_1_person_id,
           cm2.person_id as player_2_person_id
         from public.competition_match m
         join public.competition_round r on r.id = m.competition_round_id
         join public.competition_entry e1 on e1.id = m.player_1_entry_id
         join public.club_membership cm1 on cm1.id = e1.club_membership_id
         join public.competition_entry e2 on e2.id = m.player_2_entry_id
         join public.club_membership cm2 on cm2.id = e2.club_membership_id
         where m.id = $1`,
        [matchId]
      );
      const players = playerResult.rows[0];
      if (!players) throw new Error("Match players could not be loaded.");

      const canReport = players.player_1_person_id === user.personId || players.player_2_person_id === user.personId;
      if (!canReport) throw new Error("You can only report your own competition match.");

      const roundResult = await client.query<{ frames_to_play: number }>(
        `select frames_to_play
         from public.competition_round
         where id = $1`,
        [match.competition_round_id]
      );
      const framesToPlay = roundResult.rows[0]?.frames_to_play ?? 1;
      const winningScore = Math.floor(framesToPlay / 2) + 1;
      if (Math.max(player1Score, player2Score) !== winningScore || Math.min(player1Score, player2Score) >= winningScore) {
        throw new Error(`Enter a valid best-of-${framesToPlay} score.`);
      }

      const winnerEntryId = player1Score > player2Score ? match.player_1_entry_id : match.player_2_entry_id;
      await client.query(
        `update public.competition_match
         set player_1_score = $2,
             player_2_score = $3,
             winner_entry_id = $4,
             status = 'Completed',
             reported_by = $5,
             reported_at = now()
         where id = $1`,
        [matchId, player1Score, player2Score, winnerEntryId, user.personId]
      );

      const nextRound = await client.query<{ id: string }>(
        `select id
         from public.competition_round
         where competition_id = $1
           and round_number = $2
         limit 1`,
        [id, players.round_number + 1]
      );
      if (nextRound.rows[0]) {
        const nextMatchNumber = Math.ceil(match.match_number / 2);
        const winnerColumn = match.match_number % 2 === 1 ? "player_1_entry_id" : "player_2_entry_id";
        await client.query(
          `insert into public.competition_match (competition_round_id, match_number, ${winnerColumn}, status)
           values ($1, $2, $3, 'Scheduled')
           on conflict (competition_round_id, match_number) do update
           set ${winnerColumn} = excluded.${winnerColumn},
               status = case
                 when public.competition_match.player_1_entry_id is not null
                  and public.competition_match.player_2_entry_id is not null
                 then 'Scheduled'
                 else public.competition_match.status
               end`,
          [nextRound.rows[0].id, nextMatchNumber, winnerEntryId]
        );
        await client.query("update public.competition set status = 'In Progress', updated_at = now() where id = $1", [id]);
      } else {
        await client.query("update public.competition set status = 'Complete', updated_at = now() where id = $1", [id]);
      }
    });

    return NextResponse.json({ ok: true, competition: await loadCompetitionDetail(user, id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not record result." },
      { status: 400 }
    );
  }
}
