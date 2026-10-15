import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { performCupDraw } from "@/lib/server/cup-competitions";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ competitionId: string }> }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const administrator = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
    if (!administrator.rowCount) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const { competitionId } = await params;

    await withTransaction(async (client) => {
      await performCupDraw(client, competitionId, user.personId);
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/cup-competitions', 'Performed cup draw', jsonb_build_object('competition_id', $2::uuid))`,
        [user.personId, competitionId]
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not perform cup draw." }, { status: 400 });
  }
}
