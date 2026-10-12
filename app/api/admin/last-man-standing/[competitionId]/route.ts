import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

async function operator() {
  const user = await currentUser();
  if (!user) return null;
  const result = await dbQuery("select 1 from public.app_operator where person_id = $1 and active = true limit 1", [user.personId]);
  return result.rowCount ? user : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  try {
    const user = await operator();
    if (!user) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
    const { competitionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const status = String(body.status ?? "");
    const allowed = new Set(["Draft", "Open", "In Progress", "Complete", "No Winner", "Archived"]);
    if (!allowed.has(status)) return NextResponse.json({ error: "Choose a valid competition status." }, { status: 400 });
    await withTransaction(async (client) => {
      const locked = await client.query<{ name: string; locked_rounds: number }>(
        `select c.name,
                count(r.id) filter (where r.status in ('Locked', 'Needs Review', 'Settled'))::int as locked_rounds
         from public.last_man_standing_competition c
         left join public.last_man_standing_round r on r.competition_id = c.id
         where c.id = $1 group by c.id for update of c`,
        [competitionId]
      );
      if (!locked.rows[0]) throw new Error("Competition not found.");
      await client.query("update public.last_man_standing_competition set status = $2, updated_at = now() where id = $1", [competitionId, status]);
      if (status === "Open") {
        await client.query(
          `update public.last_man_standing_round set status = 'Open', opened_at = coalesce(opened_at, now()), updated_at = now()
           where competition_id = $1 and cycle_number = 1 and round_number = 1 and status = 'Planned'`,
          [competitionId]
        );
      }
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/last-man-standing', 'Updated Last Man Standing competition',
           jsonb_build_object('action', 'Changed status', 'competition_id', $2::text, 'competition_name', $3::text, 'status', $4::text, 'changed_fields', jsonb_build_array('status')))`,
        [user.personId, competitionId, locked.rows[0].name, status]
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Competition could not be updated." }, { status: 400 });
  }
}
