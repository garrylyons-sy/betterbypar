import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { createCompetitionDraw } from "@/lib/server/competition-draw";
import { canManageCompetition, loadCompetitionDetail } from "@/lib/server/competitions";
import { withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

function bracketRoundCount(entrantCount: number) {
  return Math.ceil(Math.log2(Math.max(2, entrantCount)));
}

function roundName(roundNumber: number, totalRounds: number) {
  const entrantsAtRound = 2 ** (totalRounds - roundNumber + 1);
  if (entrantsAtRound === 2) return "Final";
  if (entrantsAtRound === 4) return "Semi Final";
  if (entrantsAtRound === 8) return "Quarter Final";
  return `Round of ${entrantsAtRound}`;
}

function addDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { id } = await params;
    if (!await canManageCompetition(user, id)) {
      return NextResponse.json({ error: "Club admin access is required." }, { status: 403 });
    }

    await withTransaction(async (client) => {
      const existing = await client.query("select 1 from public.competition_match m join public.competition_round r on r.id = m.competition_round_id where r.competition_id = $1 limit 1", [id]);
      if (existing.rowCount) throw new Error("A draw already exists for this competition.");

      const entries = await client.query<{ id: string }>(
        `select id
         from public.competition_entry
         where competition_id = $1
           and status = 'Entered'
         order by entered_at`,
        [id]
      );

      if (entries.rows.length < 2) throw new Error("At least two entrants are needed to run a draw.");

      const competition = await client.query<{ entry_closes_at: string }>(
        "select entry_closes_at::text from public.competition where id = $1 and status = 'Open'",
        [id]
      );
      const entryClosesAt = competition.rows[0]?.entry_closes_at;
      if (!entryClosesAt) throw new Error("Only open competitions can be drawn.");

      await client.query("delete from public.competition_round where competition_id = $1", [id]);

      const totalRounds = bracketRoundCount(entries.rows.length);
      const generatedRounds: Array<{ id: string; round_number: number }> = [];
      for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber += 1) {
        const round = await client.query<{ id: string; round_number: number }>(
          `insert into public.competition_round (competition_id, round_number, name, frames_to_play, play_by_date)
           values ($1, $2, $3, 1, $4::date)
           returning id, round_number`,
          [id, roundNumber, roundName(roundNumber, totalRounds), addDays(entryClosesAt, roundNumber * 14)]
        );
        generatedRounds.push(round.rows[0]);
      }

      await createCompetitionDraw(client, generatedRounds, entries.rows);

      await client.query("update public.competition set status = 'Drawn', updated_at = now() where id = $1", [id]);
    });

    return NextResponse.json({ ok: true, competition: await loadCompetitionDetail(user, id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not run draw." },
      { status: 400 }
    );
  }
}
