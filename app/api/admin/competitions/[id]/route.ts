import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

async function requireAdministrator() {
  const user = await currentUser();
  if (!user) return { user: null, administrator: false };
  const { rowCount } = await dbQuery(
    "select 1 from public.app_operator where person_id = $1 and active = true limit 1",
    [user.personId]
  );
  return { user, administrator: Boolean(rowCount) };
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, administrator } = await requireAdministrator();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!administrator) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

    const { id } = await params;
    const deleted = await dbQuery<{ name: string }>(
      "delete from public.competition where id = $1 returning name",
      [id]
    );
    const competition = deleted.rows[0];
    if (!competition) return NextResponse.json({ error: "Competition not found." }, { status: 404 });

    return NextResponse.json({ ok: true, name: competition.name });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete competition." },
      { status: 400 }
    );
  }
}

function validDate(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, administrator } = await requireAdministrator();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!administrator) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const rounds = Array.isArray(body.rounds) ? body.rounds : [];
    if (!rounds.length) return NextResponse.json({ error: "At least one round date is required." }, { status: 400 });

    await withTransaction(async (client) => {
      for (const round of rounds) {
        const roundId = String(round.id ?? "").trim();
        const playByDate = validDate(round.playByDate);
        if (!roundId || !playByDate) throw new Error("Each round needs a valid play-by date.");
        const updated = await client.query(
          `update public.competition_round
           set play_by_date = $3::date
           where id = $1
             and competition_id = $2`,
          [roundId, id, playByDate]
        );
        if (!updated.rowCount) throw new Error("Round not found.");
      }
      await client.query("update public.competition set updated_at = now() where id = $1", [id]);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update round dates." },
      { status: 400 }
    );
  }
}
