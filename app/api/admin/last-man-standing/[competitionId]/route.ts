import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

const VALID_STATUS_TRANSITIONS: Record<string, Set<string>> = {
  Draft: new Set(["Open", "Archived"]),
  Open: new Set(["Archived"]),
  "In Progress": new Set(["Archived"]),
  Complete: new Set(["Archived"]),
  "No Winner": new Set(["Archived"]),
  Archived: new Set()
};

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
    const processingTime = String(body.processingTime ?? "").trim();
    if (processingTime) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(processingTime)) {
        return NextResponse.json({ error: "Choose a valid processing time." }, { status: 400 });
      }
      const result = await dbQuery<{ name: string }>(
        `update public.last_man_standing_competition
         set processing_time = $2::time, updated_at = now()
         where id = $1 returning name`,
        [competitionId, processingTime]
      );
      if (!result.rows[0]) return NextResponse.json({ error: "Competition not found." }, { status: 404 });
      await dbQuery(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/last-man-standing', 'Updated Last Man Standing processing time',
           jsonb_build_object('action', 'Changed processing time', 'competition_id', $2::text,
             'competition_name', $3::text, 'processing_time', $4::text, 'changed_fields', jsonb_build_array('processing_time')))`,
        [user.personId, competitionId, result.rows[0].name, processingTime]
      );
      return NextResponse.json({ ok: true });
    }
    if (status !== "Open") {
      return NextResponse.json({ error: "That competition status is managed by round processing." }, { status: 400 });
    }
    await withTransaction(async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtext($1), hashtext('lifecycle'))", [competitionId]);
      const locked = await client.query<{ name: string; status: string }>(
        `select c.name, c.status
         from public.last_man_standing_competition c
         where c.id = $1 for update`,
        [competitionId]
      );
      if (!locked.rows[0]) throw new Error("Competition not found.");
      if (!VALID_STATUS_TRANSITIONS[locked.rows[0].status]?.has(status)) {
        throw new Error(`A ${locked.rows[0].status} competition cannot be changed to ${status}.`);
      }
      await client.query("update public.last_man_standing_competition set status = $2, updated_at = now() where id = $1", [competitionId, status]);
      if (status === "Open") {
        await client.query(
          `update public.last_man_standing_round set status = 'Open', opened_at = coalesce(opened_at, now()), updated_at = now()
           where id = (
             select id from public.last_man_standing_round
             where competition_id = $1 and status = 'Planned'
             order by cycle_number, round_number limit 1
           )`,
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

export async function DELETE(_: Request, context: { params: Promise<{ competitionId: string }> }) {
  try {
    const user = await operator();
    if (!user) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
    const { competitionId } = await context.params;
    await withTransaction(async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtext($1), hashtext('lifecycle'))", [competitionId]);
      const competition = await client.query<{ name: string }>(
        "select name from public.last_man_standing_competition where id = $1 for update",
        [competitionId]
      );
      if (!competition.rows[0]) throw new Error("Competition not found.");
      await client.query(
        `insert into public.user_activity_log (person_id, activity_type, page_path, page_label, metadata)
         values ($1, 'Page Visit', '/admin/last-man-standing', 'Deleted Last Man Standing competition',
           jsonb_build_object('action', 'Deleted competition', 'competition_id', $2::text, 'competition_name', $3::text))`,
        [user.personId, competitionId, competition.rows[0].name]
      );
      await client.query("delete from public.last_man_standing_competition where id = $1", [competitionId]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Competition could not be deleted." }, { status: 400 });
  }
}
