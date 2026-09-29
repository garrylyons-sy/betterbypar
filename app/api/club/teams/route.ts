import { NextRequest, NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

type ClubTeamRow = {
  team_id: string;
  team_name: string;
  league_name: "A League" | "B League" | "C League";
  season_name: string;
  logo_path: string;
  primary_color: string;
  accent_color: string;
  league_position: number | null;
  matches_played: number | null;
  league_points: number | null;
  player_count: string;
  manager_count: string;
  assistant_manager_count: string;
  next_fixture_date: string | null;
  next_opponent_name: string | null;
  next_home_away: "Home" | "Away" | null;
  people: Array<{
    personId: string;
    name: string;
    role: string;
  }> | null;
};

export async function GET(request: NextRequest) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const club = request.nextUrl.searchParams.get("club")?.trim();
    const season = request.nextUrl.searchParams.get("season")?.trim();
    if (!club) return NextResponse.json({ error: "club is required." }, { status: 400 });

    const access = await dbQuery<{ can_view: boolean }>(
      `select exists (
         select 1
         from public.app_operator ao
         where ao.person_id = $1
           and ao.active = true
         union
         select 1
         from public.club_membership cm
         join public.club c on c.id = cm.club_id
         where cm.person_id = $1
           and cm.active = true
           and c.name = $2
       ) as can_view`,
      [user.personId, club]
    );

    if (!access.rows[0]?.can_view) {
      return NextResponse.json({ error: "Club access required." }, { status: 403 });
    }

    const { rows } = await dbQuery<ClubTeamRow>(
      `with target_season as (
         select id, name
         from public.season
         where case
           when nullif($2, '') is not null and $2 <> 'Club' then name = $2
           else coalesce(active, false) = true
         end
         order by coalesce(active, false) desc, name desc
         limit 1
       ),
       target_teams as (
         select
           t.id,
           t.name,
           t.club_id,
           t.league_id,
           c.logo_path,
           c.primary_color,
           coalesce(c.accent_color, '#10233F') as accent_color,
           l.name as league_name,
           s.name as season_name
         from public.team t
         join public.club c on c.id = t.club_id and c.active = true
         join public.league l on l.id = t.league_id
         join target_season s on s.id = t.season_id
         where c.name = $1
           and t.active = true
       ),
       role_people as (
         select distinct tt.id as team_id, ptr.person_id, ptr.role::text as role
         from target_teams tt
         join public.person_team_role ptr
           on ptr.club_id = tt.club_id
          and ptr.league_id = tt.league_id
          and ptr.team_name = tt.name
          and ptr.active = true
         union
         select distinct tt.id as team_id, tm.person_id, tm.role::text as role
         from target_teams tt
         join public.team_membership tm
           on tm.team_id = tt.id
          and tm.active = true
       )
       select
         tt.id as team_id,
         tt.name as team_name,
         tt.league_name,
         tt.season_name,
         tt.logo_path,
         tt.primary_color,
         tt.accent_color,
         ltv.position as league_position,
         ltv.matches_played,
         ltv.league_points,
         count(distinct rp.person_id) filter (where rp.role = 'Player')::text as player_count,
         count(distinct rp.person_id) filter (where rp.role = 'Manager')::text as manager_count,
         count(distinct rp.person_id) filter (where rp.role = 'Assistant Manager')::text as assistant_manager_count,
         coalesce(
           jsonb_agg(
             distinct jsonb_build_object(
               'personId', p.id,
               'name', concat_ws(' ', p.first_name, p.last_name),
               'role', rp.role
             )
           ) filter (where p.id is not null),
           '[]'::jsonb
         ) as people,
         next_fixture.fixture_date::text as next_fixture_date,
         next_fixture.opponent_name as next_opponent_name,
         next_fixture.home_away as next_home_away
       from target_teams tt
       left join public.league_table_view ltv on ltv.team_id = tt.id
       left join role_people rp on rp.team_id = tt.id
       left join public.person p on p.id = rp.person_id and p.active = true
       left join lateral (
         select
           f.fixture_date,
           case when f.home_team_id = tt.id then away_team.name else home_team.name end as opponent_name,
           case when f.home_team_id = tt.id then 'Home' else 'Away' end as home_away
         from public.fixture f
         join public.team home_team on home_team.id = f.home_team_id
         join public.team away_team on away_team.id = f.away_team_id
         where f.status = 'Scheduled'
           and coalesce(f.fixture_type, 'League') = 'League'
           and (f.home_team_id = tt.id or f.away_team_id = tt.id)
         order by f.fixture_date asc
         limit 1
       ) next_fixture on true
       group by
         tt.id,
         tt.name,
         tt.league_name,
         tt.season_name,
         tt.logo_path,
         tt.primary_color,
         tt.accent_color,
         ltv.position,
         ltv.matches_played,
         ltv.league_points,
         next_fixture.fixture_date,
         next_fixture.opponent_name,
         next_fixture.home_away
       order by tt.league_name, tt.name`,
      [club, season ?? ""]
    );

    return NextResponse.json({
      club,
      season: rows[0]?.season_name ?? season ?? null,
      teams: rows.map((row) => ({
        teamId: row.team_id,
        name: row.team_name,
        league: row.league_name,
        season: row.season_name,
        logoPath: row.logo_path,
        primaryColor: row.primary_color,
        accentColor: row.accent_color,
        position: row.league_position === null ? null : Number(row.league_position),
        matchesPlayed: Number(row.matches_played ?? 0),
        points: Number(row.league_points ?? 0),
        playerCount: Number(row.player_count),
        managerCount: Number(row.manager_count),
        assistantManagerCount: Number(row.assistant_manager_count),
        nextFixtureDate: row.next_fixture_date,
        nextOpponentName: row.next_opponent_name,
        nextHomeAway: row.next_home_away,
        people: (row.people ?? [])
          .map((person) => ({
            personId: person.personId,
            name: person.name,
            role: person.role
          }))
          .sort((a, b) => {
            const roleOrder = (role: string) => role === "Manager" ? 0 : role === "Assistant Manager" ? 1 : 2;
            return roleOrder(a.role) - roleOrder(b.role) || a.name.localeCompare(b.name);
          })
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Club teams unavailable." },
      { status: 500 }
    );
  }
}
