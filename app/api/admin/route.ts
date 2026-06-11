import { NextResponse } from "next/server";

import { loadAppearanceConfig } from "@/lib/server/appearance";
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

    const [teams, peopleResult, logsResult, requestsResult, invitesResult, appearance] = await Promise.all([
      loadTeamOptions(),
      dbQuery(
        `select distinct on (p.id)
           p.id as person_id,
           p.first_name,
           p.last_name,
           p.email,
           p.phone,
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
      dbQuery("select id, requested_person_name, email, status, message, created_at from public.invitation_request order by created_at desc limit 25"),
      dbQuery(
        `select
           i.id,
           i.email,
           i.invited_person_name,
           i.status::text,
           i.created_at,
           i.expires_at,
           i.accepted_at,
           i.invite_administrator,
           c.name as club_name,
           coalesce(r.roles, '[]'::jsonb) as roles
         from public.invitation i
         left join public.club c on c.id = i.invited_club_id
         left join lateral (
           select jsonb_agg(role_item order by sort_key, role_label) as roles
           from (
             select
               l.name as sort_key,
               concat(im.role::text, ' - ', t.name) as role_label,
               jsonb_build_object(
                 'role', im.role::text,
                 'team_name', t.name,
                 'league_name', l.name
               ) as role_item
             from public.invitation_membership im
             join public.team t on t.id = im.team_id
             join public.league l on l.id = t.league_id
             where im.invitation_id = i.id
             union all
             select
               'Club' as sort_key,
               'Club Member' as role_label,
               jsonb_build_object(
                 'role', icm.role,
                 'team_name', c2.name,
                 'league_name', 'Club'
               ) as role_item
             from public.invitation_club_membership icm
             join public.club c2 on c2.id = icm.club_id
             where icm.invitation_id = i.id
           ) role_rows
         ) r on true
         order by i.created_at desc
         limit 50`
      ),
      loadAppearanceConfig()
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
      requests: requestsResult.rows,
      invites: invitesResult.rows,
      appearance
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin data unavailable." },
      { status: 500 }
    );
  }
}
