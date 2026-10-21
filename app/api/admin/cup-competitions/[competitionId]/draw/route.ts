import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { changeCupDraw } from "@/lib/server/cup-draw-workflow";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ competitionId: string }> }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const administrator = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
    if (!administrator.rowCount) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const { competitionId } = await params;

    // Older open admin screens sent a bodyless POST to publish a draw immediately.
    // Require a refresh rather than interpreting that request as any new draw action.
    const rawBody = await request.text();
    if (!rawBody.trim()) {
      return NextResponse.json({ error: "This draw screen is out of date. Refresh the page, then choose Run provisional draw. No fixtures have been published." }, { status: 409 });
    }
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid draw request. Refresh the page and try again." }, { status: 400 });
    }
    if (!body || Array.isArray(body) || !["draw", "redraw", "reveal", "confirm"].includes(body.action)) {
      return NextResponse.json({ error: "Invalid draw request. Refresh the page and try again." }, { status: 400 });
    }
    if (!/^[0-9a-f-]{36}$/i.test(competitionId)) return NextResponse.json({ error: "Invalid competition." }, { status: 400 });
    await withTransaction(async (client) => {
      await changeCupDraw(client, competitionId, user.personId, body);
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/cup-competitions', 'Cup draw action', jsonb_build_object('competition_id', $2::uuid, 'action', $3::text, 'attempt_id', $4::text))`,
        [user.personId, competitionId, body.action, body.attemptId ?? null]
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not perform cup draw." }, { status: 400 });
  }
}
