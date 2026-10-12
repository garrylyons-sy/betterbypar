import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";
import { processDueLastManStandingWork } from "@/lib/server/last-man-standing";

export async function POST(_: Request, context: { params: Promise<{ competitionId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const operator = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
  if (!operator.rowCount) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  const { competitionId } = await context.params;
  try {
    const results = await processDueLastManStandingWork({ competitionId, actorPersonId: user.personId });
    await dbQuery(
      `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
       values ($1, 'Page Visit', '/admin/last-man-standing', 'Processed Last Man Standing competition',
         jsonb_build_object('action', 'Processed competition', 'competition_id', $2::text, 'result_count', $3::int))`,
      [user.personId, competitionId, results.length]
    );
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Competition could not be processed." }, { status: 400 });
  }
}
