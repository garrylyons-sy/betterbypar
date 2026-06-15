import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { canManageCompetition, loadCompetitionDetail } from "@/lib/server/competitions";
import { withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
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

      const rounds = await client.query<{ id: string; round_number: number }>(
        `select id, round_number
         from public.competition_round
         where competition_id = $1
         order by round_number`,
        [id]
      );
      const firstRound = rounds.rows[0];
      if (!firstRound) throw new Error("Add at least one round before running a draw.");

      const entries = await client.query<{ id: string }>(
        `select id
         from public.competition_entry
         where competition_id = $1
           and status = 'Entered'
         order by entered_at`,
        [id]
      );
      if (entries.rows.length < 2) throw new Error("At least two entrants are needed to run a draw.");
      const bracketCapacity = 2 ** rounds.rows.length;
      if (entries.rows.length > bracketCapacity) {
        throw new Error(`${entries.rows.length} entrants need more than ${rounds.rows.length} rounds. Add an earlier round before running the draw.`);
      }

      const drawn = shuffle(entries.rows);
      for (let index = 0; index < drawn.length; index += 2) {
        const player1 = drawn[index];
        const player2 = drawn[index + 1] ?? null;
        await client.query(
          `insert into public.competition_match (
             competition_round_id,
             match_number,
             player_1_entry_id,
             player_2_entry_id,
             winner_entry_id,
             status
           )
           values ($1, $2, $3, $4, $5, $6)`,
          [firstRound.id, Math.floor(index / 2) + 1, player1.id, player2?.id ?? null, player2 ? null : player1.id, player2 ? "Scheduled" : "Bye"]
        );
      }

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
