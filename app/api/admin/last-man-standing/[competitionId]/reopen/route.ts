import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";
import { LastManStandingError, reopenLastManStandingRound } from "@/lib/server/last-man-standing";

export async function POST(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const operator = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
  if (!operator.rowCount) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  try {
    const { competitionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await reopenLastManStandingRound({
      competitionId,
      roundId: String(body.roundId ?? ""),
      actorPersonId: user.personId,
      reason: String(body.reason ?? "")
    });
    await dbQuery(
      `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
       values ($1, 'Page Visit', '/admin/last-man-standing', 'Reopened Last Man Standing round',
         jsonb_build_object('action', 'Reopened round', 'competition_id', $2::text, 'round_id', $3::text, 'reason', $4::text))`,
      [user.personId, competitionId, body.roundId, body.reason]
    );
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof LastManStandingError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Round could not be reopened." }, { status });
  }
}
