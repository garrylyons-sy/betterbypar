import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { createCompetitionDraw } from "@/lib/server/competition-draw";
import { canManageCompetition, loadCompetitionDetail } from "@/lib/server/competitions";
import { withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

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

      const entries = await client.query<{ id: string }>(
        `select id
         from public.competition_entry
         where competition_id = $1
           and status = 'Entered'
         order by entered_at`,
        [id]
      );
      await createCompetitionDraw(client, rounds.rows, entries.rows);

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
