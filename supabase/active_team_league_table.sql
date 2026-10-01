-- Keep league tables contiguous and exclude dormant teams from ranking.

create or replace view public.league_table_view as
with team_stats as (
  select
    t.id as team_id,
    t.name as team_name,
    t.league_id,
    t.season_id,
    count(mp.match_id) filter (where completed_fixture.status = 'Completed') as matches_played,
    coalesce(sum(case when completed_fixture.status = 'Completed' and mp.home_team_points > mp.away_team_points and mp.home_team_id = t.id then 1 when completed_fixture.status = 'Completed' and mp.away_team_points > mp.home_team_points and mp.away_team_id = t.id then 1 else 0 end), 0) as matches_won,
    coalesce(sum(case when completed_fixture.status = 'Completed' and mp.home_team_points < mp.away_team_points and mp.home_team_id = t.id then 1 when completed_fixture.status = 'Completed' and mp.away_team_points < mp.home_team_points and mp.away_team_id = t.id then 1 else 0 end), 0) as matches_lost,
    coalesce(sum(case when mp.home_team_id = t.id then mp.home_team_points when mp.away_team_id = t.id then mp.away_team_points else 0 end), 0) as points_for,
    coalesce(sum(case when mp.home_team_id = t.id then mp.away_team_points when mp.away_team_id = t.id then mp.home_team_points else 0 end), 0) as points_against,
    coalesce(sum(case when mp.home_team_id = t.id then mp.home_team_points when mp.away_team_id = t.id then mp.away_team_points else 0 end), 0) as league_points
  from public.team t
  left join public.match_points_view mp on mp.home_team_id = t.id or mp.away_team_id = t.id
  left join public.fixture completed_fixture on completed_fixture.id = mp.fixture_id
  where t.active = true
  group by t.id, t.name, t.league_id, t.season_id
),
head_to_head as (
  select
    ts.team_id,
    coalesce(sum(case when mp.home_team_id = ts.team_id then mp.home_team_points when mp.away_team_id = ts.team_id then mp.away_team_points else 0 end), 0) as head_to_head_points
  from team_stats ts
  left join team_stats tied_team
    on tied_team.league_id = ts.league_id
   and tied_team.season_id = ts.season_id
   and tied_team.league_points = ts.league_points
   and tied_team.team_id <> ts.team_id
  left join public.match_points_view mp
    on ((mp.home_team_id = ts.team_id and mp.away_team_id = tied_team.team_id)
     or (mp.away_team_id = ts.team_id and mp.home_team_id = tied_team.team_id))
  group by ts.team_id
)
select
  row_number() over (
    partition by ts.league_id, ts.season_id
    order by
      ts.league_points desc,
      hth.head_to_head_points desc,
      (ts.points_for - ts.points_against) desc,
      ts.matches_won desc,
      ts.team_name asc
  ) as position,
  ts.team_id,
  ts.league_id,
  ts.season_id,
  ts.matches_played,
  ts.matches_won,
  ts.matches_lost,
  ts.points_for,
  ts.points_against,
  ts.league_points
from team_stats ts
join head_to_head hth on hth.team_id = ts.team_id;
