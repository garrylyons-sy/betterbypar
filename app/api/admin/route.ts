import { NextResponse } from "next/server";

import { currentUser, loadTeamOptions } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

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

export async function GET() {
  try {
    const { user, administrator } = await requireAdministrator();
    if (!user) return NextResponse.json({ authenticated: false, administrator: false }, { status: 401 });
    if (!administrator) return NextResponse.json({ authenticated: true, administrator: false, user }, { status: 403 });

    const [teams, peopleResult, logsResult, requestsResult] = await Promise.all([
      loadTeamOptions(),
      dbQuery(
        `select distinct on (p.id)
           p.id as person_id,
           p.first_name,
           p.last_name,
           p.email,
           coalesce(ao.active, false) as admin
         from public.person p
         left join public.app_operator ao on ao.person_id = p.id
         where p.active = true
         order by p.id, p.last_name nulls last, p.first_name`
      ),
      dbQuery(
        `select
           l.id,
           l.activity_type,
           l.page_label,
           l.page_path,
           l.created_at,
           l.metadata,
           p.first_name,
           p.last_name,
           p.email
         from public.user_activity_log l
         left join public.person p on p.id = l.person_id
         order by l.created_at desc
         limit 50`
      ),
      dbQuery("select id, requested_person_name, email, status, message, created_at from public.invitation_request order by created_at desc limit 25")
    ]);

    return NextResponse.json({
      authenticated: true,
      administrator: true,
      user,
      teams,
      people: peopleResult.rows,
      logs: logsResult.rows.map((row) => ({
        id: row.id,
        activity_type: row.activity_type,
        page_label: row.page_label,
        page_path: row.page_path,
        created_at: row.created_at,
        metadata: row.metadata,
        person: row.first_name ? {
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email
        } : null
      })),
      requests: requestsResult.rows
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin data unavailable." },
      { status: 500 }
    );
  }
}
