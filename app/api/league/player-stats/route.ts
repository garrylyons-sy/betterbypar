import { NextRequest, NextResponse } from "next/server";

import { currentUserFromRequest } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

type LeaguePlayerStatRow = {
  person_id: string;
  player_name: string;
  team_name: string;
  played: string;
  won: string;
  lost: string;
  remaining_fixtures: string;
  highest_break: number | null;
};

async function canViewLeague(personId: string, leagueName: string, seasonName: string) {
  const { rows } = await dbQuery<{ can_view: boolean }>(
    `with target as (
       select l.id as league_id, s.id as season_id
       from public.league l
       cross join public.season s
       where l.name = $2
         and s.name = $3
       limit 1
     )
     select exists (
       select 1
       from public.app_operator ao
       where ao.person_id = $1
         and ao.active = true
       union
       select 1
       from public.person_team_role ptr
       join public.club_membership cm on cm.id = ptr.club_membership_id and cm.active = true
       where ptr.person_id = $1
         and ptr.active = true
         and ptr.role in ('Player', 'Manager')
       union
       select 1
       from public.person_team_role ptr
       join public.club_membership cm on cm.id = ptr.club_membership_id and cm.active = true
       join target t on t.league_id = ptr.league_id
       where ptr.person_id = $1
         and ptr.active = true
         and ptr.role in ('Player', 'Manager')
       union
       select 1
       from public.team_membership tm
       join public.team team on team.id = tm.team_id and team.active = true
       join target t on t.league_id = team.league_id and t.season_id = team.season_id
       where tm.person_id = $1
         and tm.active = true
         and tm.role in ('Player', 'Manager')
     ) as can_view`,
    [personId, leagueName, seasonName]
  );
  return Boolean(rows[0]?.can_view);
}

export async function GET(request: NextRequest) {
  try {
    const user = await currentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const league = request.nextUrl.searchParams.get("league")?.trim();
    const season = request.nextUrl.searchParams.get("season")?.trim();
    if (!league || !season) return NextResponse.json({ error: "league and season are required." }, { status: 400 });

    if (!await canViewLeague(user.personId, league, season)) {
      return NextResponse.json({ error: "League access required." }, { status: 403 });
    }

    const stats = await dbQuery<LeaguePlayerStatRow>(
      `with target as (
         select l.id as league_id, s.id as season_id
         from public.league l
         cross join public.season s
         where l.name = $1
           and s.name = $2
         limit 1
       ),
       league_teams as (
         select t.id as team_id, t.name as team_name, t.club_id, t.league_id, t.season_id
         from public.team t
         join target target on target.league_id = t.league_id and target.season_id = t.season_id
         where t.active = true
       ),
       league_players as (
         select distinct ptr.person_id, lt.team_id, lt.team_name
         from public.person_team_role ptr
         join public.club_membership cm on cm.id = ptr.club_membership_id and cm.active = true
         join league_teams lt on lt.club_id = ptr.club_id
          and lt.league_id = ptr.league_id
          and lt.team_name = ptr.team_name
         where ptr.role = 'Player'
           and ptr.active = true
         union
         select distinct tm.person_id, lt.team_id, lt.team_name
         from public.team_membership tm
         join league_teams lt on lt.team_id = tm.team_id
         where tm.role = 'Player'
           and tm.active = true
       ),
       game_stats as (
         select
           lp.person_id,
           count(distinct pgr.game_id) filter (
             where pgr.player_1_id = lp.person_id or pgr.player_2_id = lp.person_id
           ) as played,
           count(distinct pgr.game_id) filter (
             where pgr.winner_player_id = lp.person_id
           ) as won,
           count(distinct pgr.game_id) filter (
             where pgr.loser_player_id = lp.person_id
           ) as lost
         from league_players lp
         left join public.player_game_result_view pgr
           on pgr.season_id = (select season_id from target)
          and pgr.league_id = (select league_id from target)
          and (pgr.player_1_id = lp.person_id or pgr.player_2_id = lp.person_id)
         group by lp.person_id
       ),
       remaining as (
         select lt.team_id, count(f.id) as remaining_fixtures
         from league_teams lt
         left join public.fixture f
           on f.season_id = lt.season_id
          and f.league_id = lt.league_id
          and f.status = 'Scheduled'
          and coalesce(f.fixture_type, 'League') = 'League'
          and (f.home_team_id = lt.team_id or f.away_team_id = lt.team_id)
         group by lt.team_id
       ),
       break_stats as (
         select b.player_id as person_id, max(b.break_value) as highest_break
         from public.break b
         left join public.game break_game on break_game.id = b.game_id
         left join public.match break_match on break_match.id = break_game.match_id
         left join public.fixture break_fixture on break_fixture.id = break_match.fixture_id
         where b.season_id = (select season_id from target)
           and b.league_id = (select league_id from target)
           and (break_fixture.id is null or coalesce(break_fixture.fixture_type, 'League') = 'League')
         group by b.player_id
       ),
       raw_stats as (
         select
           p.id as person_id,
           concat_ws(' ', p.first_name, p.last_name) as player_name,
           p.email,
           lp.team_name,
           coalesce(gs.played, 0)::text as played,
           coalesce(gs.won, 0)::text as won,
           coalesce(gs.lost, 0)::text as lost,
           coalesce(r.remaining_fixtures, 0)::text as remaining_fixtures,
           bs.highest_break
         from league_players lp
         join public.person p on p.id = lp.person_id and p.active = true
         left join game_stats gs on gs.person_id = lp.person_id
         left join remaining r on r.team_id = lp.team_id
         left join break_stats bs on bs.person_id = lp.person_id
         where coalesce(gs.played, 0) > 0
       ),
       labelled_stats as (
         select
           person_id,
           case
             when count(*) over (partition by lower(player_name), team_name) > 1
               then player_name || ' · ' || coalesce(nullif(split_part(email, '@', 1), ''), left(person_id::text, 8))
             when count(*) over (partition by lower(player_name)) > 1
               then player_name || ' · ' || team_name
             else player_name
           end as player_name,
           team_name,
           played,
           won,
           lost,
           remaining_fixtures,
           highest_break
         from raw_stats
       )
       select
         person_id,
         player_name,
         team_name,
         played,
         won,
         lost,
         remaining_fixtures,
         highest_break
       from labelled_stats
       order by
         case when played::numeric + remaining_fixtures::numeric >= 12 then 0 else 1 end,
         case
           when played::numeric > 0 then won::numeric / played::numeric
           else -1
         end desc,
         won::numeric desc,
         played::numeric desc,
         highest_break desc nulls last,
         player_name`,
      [league, season]
    );

    return NextResponse.json({
      league,
      season,
      minimumMatches: 12,
      players: stats.rows.map((row) => {
        const played = Number(row.played);
        const won = Number(row.won);
        const lost = Number(row.lost);
        const remainingFixtures = Number(row.remaining_fixtures);
        return {
          personId: row.person_id,
          name: row.player_name,
          teamName: row.team_name,
          played,
          won,
          lost,
          remainingFixtures,
          canReachMinimum: played + remainingFixtures >= 12,
          winPercentage: played ? Math.round((won / played) * 100) : 0,
          highestBreak: row.highest_break ?? null
        };
      })
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "League player stats unavailable." },
      { status: 500 }
    );
  }
}
