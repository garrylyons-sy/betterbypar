import { NextResponse } from "next/server";

import { loadAppearanceConfig } from "@/lib/server/appearance";
import { buildAdminMatchStats } from "@/lib/server/admin-match-stats.mjs";
import { currentUser, loadTeamOptions } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

async function requireAdminAccess() {
  const user = await currentUser();
  if (!user) return { user: null, administrator: false, platformAdmin: false, clubAdminClubIds: [] as string[] };
  const [operatorResult, clubAdminResult] = await Promise.all([
    dbQuery(
    "select 1 from public.app_operator where person_id = $1 and active = true limit 1",
    [user.personId]
    ),
    dbQuery<{ club_id: string }>(
      `select club_id
       from public.club_admin
       where person_id = $1
         and active = true
       union
       select club_id
       from public.club_membership
       where person_id = $1
         and active = true
         and is_club_admin = true`,
      [user.personId]
    )
  ]);
  const platformAdmin = Boolean(operatorResult.rowCount);
  const clubAdminClubIds = clubAdminResult.rows.map((row) => row.club_id);
  return { user, administrator: platformAdmin || clubAdminClubIds.length > 0, platformAdmin, clubAdminClubIds };
}

export async function GET() {
  try {
    const { user, administrator, platformAdmin, clubAdminClubIds } = await requireAdminAccess();
    if (!user) return NextResponse.json({ authenticated: false, administrator: false }, { status: 401 });
    if (!administrator) return NextResponse.json({ authenticated: true, administrator: false, user }, { status: 403 });

    const [teams, peopleResult, requestsResult, invitesResult, competitionsResult, adsResult, matchFixturesResult, matchAppearancesResult, appearance] = await Promise.all([
      loadTeamOptions().then((rows) => platformAdmin ? rows : rows.filter((team) => clubAdminClubIds.includes(team.club_id))),
      dbQuery(
        `select distinct on (p.id)
           p.id as person_id,
           p.first_name,
           p.last_name,
           p.email,
           p.phone,
           ua.id as account_id,
           ua.username,
           ua.active as login_active,
           ua.last_login,
           inv.id as invitation_id,
           inv.status::text as invite_status,
           inv.created_at as invited_at,
           inv.sent_at as invite_sent_at,
           inv.accepted_at as invite_accepted_at,
           coalesce(ch.club_handicaps, '[]'::jsonb) as club_handicaps,
           coalesce(ca.club_admins, '[]'::jsonb) as club_admins,
           coalesce(tr.team_roles, '[]'::jsonb) as team_roles,
           coalesce(ao.active, false) as admin
         from public.person p
         left join public.app_operator ao on ao.person_id = p.id
         left join lateral (
           select id, username, active, last_login
           from public.user_account
           where person_id = p.id
           order by last_login desc nulls last, username
           limit 1
         ) ua on true
         left join lateral (
           select id, status, created_at, sent_at, accepted_at
           from public.invitation
           where lower(email) = lower(p.email)
           order by created_at desc
           limit 1
         ) inv on true
         left join lateral (
           select jsonb_agg(
             jsonb_build_object(
               'club_id', c.id,
               'club_name', c.name,
               'role', cm.role,
               'handicap', cm.handicap
             )
             order by c.name
           ) as club_handicaps
           from public.club_membership cm
           join public.club c on c.id = cm.club_id
           where cm.person_id = p.id
             and cm.active = true
         ) ch on true
         left join lateral (
           select jsonb_agg(
             jsonb_build_object(
               'club_id', c.id,
               'club_name', c.name
             )
             order by c.name
           ) as club_admins
           from public.club_admin ca
           join public.club c on c.id = ca.club_id
           where ca.person_id = p.id
             and ca.active = true
         ) ca on true
         left join lateral (
           select jsonb_agg(
             jsonb_build_object(
               'role', role_rows.role,
               'team_name', role_rows.team_name,
               'league_name', l.name,
               'club_name', c.name
             )
             order by l.name, role_rows.team_name, role_rows.role
           ) as team_roles
           from (
             select distinct ptr.role::text as role, ptr.team_name, ptr.league_id, ptr.club_id
             from public.person_team_role ptr
             where ptr.person_id = p.id
               and ptr.active = true
           ) role_rows
           join public.league l on l.id = role_rows.league_id
           join public.club c on c.id = role_rows.club_id
         ) tr on true
         where p.active = true
           and (
             $1::boolean = true
             or exists (
               select 1
               from public.club_membership scope_cm
               where scope_cm.person_id = p.id
                 and scope_cm.active = true
                 and scope_cm.club_id = any($2::uuid[])
             )
             or exists (
               select 1
               from public.club_admin scope_ca
               where scope_ca.person_id = p.id
                 and scope_ca.active = true
                 and scope_ca.club_id = any($2::uuid[])
             )
           )
         order by p.id, p.last_name nulls last, p.first_name`
        ,
        [platformAdmin, clubAdminClubIds]
      ),
      platformAdmin
        ? dbQuery("select id, requested_person_name, email, status, message, created_at from public.invitation_request order by created_at desc limit 25")
        : Promise.resolve({ rows: [] }),
      dbQuery(
        `select
           i.id,
           i.email,
           i.invited_person_name,
           i.status::text,
           i.created_at,
           i.sent_at,
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
               icm.role as role_label,
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
         where $1::boolean = true
            or i.invited_club_id = any($2::uuid[])
         order by i.created_at desc
         limit 50`,
        [platformAdmin, clubAdminClubIds]
      ),
      dbQuery(
        `select
           c.id,
           c.name,
           c.competition_type,
           c.status,
           c.entry_closes_at::text,
           c.created_at,
           coalesce(cl.name, 'Interclub') as club_name,
           count(distinct ce.id) filter (where ce.status = 'Entered')::int as entrant_count,
           count(distinct cr.id)::int as round_count,
           count(distinct cm.id)::int as match_count
         from public.competition c
         left join public.club cl on cl.id = c.club_id
         left join public.competition_entry ce on ce.competition_id = c.id
         left join public.competition_round cr on cr.competition_id = c.id
         left join public.competition_match cm on cm.competition_round_id = cr.id
         where $1::boolean = true
            or c.club_id = any($2::uuid[])
         group by c.id, cl.name
         order by c.created_at desc
         limit 50`,
        [platformAdmin, clubAdminClubIds]
      ),
      platformAdmin
        ? dbQuery(
            `select id::text, name, placement, audience, image_path, link_url, affiliate_code, alt_text, active, sort_order, starts_at::text, ends_at::text
             from public.ads
             order by sort_order, name`
          )
        : Promise.resolve({ rows: [] }),
      dbQuery(
        `select
           f.id::text as fixture_id,
           l.name as league_name,
           ht.id::text as home_team_id,
           ht.name as home_team_name,
           at.id::text as away_team_id,
           at.name as away_team_name,
           f.fixture_date::text as fixture_date,
           fw.starts_on::text as week_starts_on,
           f.status::text as status,
           coalesce(m.home_team_score, 0)::int as home_team_score,
           coalesce(m.away_team_score, 0)::int as away_team_score
         from public.fixture f
         join public.season s on s.id = f.season_id
         join public.league l on l.id = f.league_id
         join public.team ht on ht.id = f.home_team_id
         join public.team at on at.id = f.away_team_id
         left join public.match m on m.fixture_id = f.id
         left join public.fixture_week_match fwm on fwm.match_id = m.id
         left join public.fixture_week fw on fw.id = fwm.week_id
         where s.active = true
           and f.fixture_type = 'League'
           and (
             $1::boolean = true
             or ht.club_id = any($2::uuid[])
             or at.club_id = any($2::uuid[])
           )
         order by l.name, f.fixture_date, ht.name`,
        [platformAdmin, clubAdminClubIds]
      ),
      dbQuery(
        `select distinct league_name, team_id::text, team_name, person_id::text, guest_name
         from (
           select l.name as league_name, f.home_team_id as team_id, ht.name as team_name, g.home_player_1_id as person_id, g.home_player_1_guest_name as guest_name
           from public.game g
           join public.match m on m.id = g.match_id
           join public.fixture f on f.id = m.fixture_id
           join public.season s on s.id = f.season_id
           join public.league l on l.id = f.league_id
           join public.team ht on ht.id = f.home_team_id
           join public.team at on at.id = f.away_team_id
           where s.active = true and f.fixture_type = 'League' and f.status = 'Completed' and ($1::boolean = true or ht.club_id = any($2::uuid[]) or at.club_id = any($2::uuid[]))
           union all
           select l.name, f.home_team_id, ht.name, g.home_player_2_id, g.home_player_2_guest_name
           from public.game g
           join public.match m on m.id = g.match_id
           join public.fixture f on f.id = m.fixture_id
           join public.season s on s.id = f.season_id
           join public.league l on l.id = f.league_id
           join public.team ht on ht.id = f.home_team_id
           join public.team at on at.id = f.away_team_id
           where s.active = true and f.fixture_type = 'League' and f.status = 'Completed' and ($1::boolean = true or ht.club_id = any($2::uuid[]) or at.club_id = any($2::uuid[]))
           union all
           select l.name, f.away_team_id, at.name, g.away_player_1_id, g.away_player_1_guest_name
           from public.game g
           join public.match m on m.id = g.match_id
           join public.fixture f on f.id = m.fixture_id
           join public.season s on s.id = f.season_id
           join public.league l on l.id = f.league_id
           join public.team ht on ht.id = f.home_team_id
           join public.team at on at.id = f.away_team_id
           where s.active = true and f.fixture_type = 'League' and f.status = 'Completed' and ($1::boolean = true or ht.club_id = any($2::uuid[]) or at.club_id = any($2::uuid[]))
           union all
           select l.name, f.away_team_id, at.name, g.away_player_2_id, g.away_player_2_guest_name
           from public.game g
           join public.match m on m.id = g.match_id
           join public.fixture f on f.id = m.fixture_id
           join public.season s on s.id = f.season_id
           join public.league l on l.id = f.league_id
           join public.team ht on ht.id = f.home_team_id
           join public.team at on at.id = f.away_team_id
           where s.active = true and f.fixture_type = 'League' and f.status = 'Completed' and ($1::boolean = true or ht.club_id = any($2::uuid[]) or at.club_id = any($2::uuid[]))
         ) appearances
         where person_id is not null or nullif(trim(guest_name), '') is not null
         order by league_name, team_name`,
        [platformAdmin, clubAdminClubIds]
      ),
      loadAppearanceConfig()
    ]);

    return NextResponse.json({
      authenticated: true,
      administrator: true,
      adminMode: platformAdmin ? "platform" : "club",
      user,
      teams,
      people: peopleResult.rows,
      requests: requestsResult.rows,
      invites: invitesResult.rows,
      competitions: competitionsResult.rows,
      ads: adsResult.rows,
      matchStats: buildAdminMatchStats({
        fixtures: matchFixturesResult.rows,
        appearances: matchAppearancesResult.rows
      }),
      appearance
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin data unavailable." },
      { status: 500 }
    );
  }
}
