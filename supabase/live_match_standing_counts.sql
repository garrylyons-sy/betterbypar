-- Live frame points should move the table during a match, but match totals should
-- only move after the fixture is complete.

create or replace view public.league_table_view as
select
  row_number() over (
    partition by t.league_id, t.season_id
    order by
      coalesce(sum(case when mp.home_team_id = t.id then mp.home_team_points when mp.away_team_id = t.id then mp.away_team_points else 0 end), 0) desc,
      coalesce(sum(case when mp.home_team_id = t.id then mp.home_team_points - mp.away_team_points when mp.away_team_id = t.id then mp.away_team_points - mp.home_team_points else 0 end), 0) desc,
      coalesce(sum(case when completed_fixture.status = 'Completed' and mp.home_team_points > mp.away_team_points and mp.home_team_id = t.id then 1 when completed_fixture.status = 'Completed' and mp.away_team_points > mp.home_team_points and mp.away_team_id = t.id then 1 else 0 end), 0) desc,
      t.name asc
  ) as position,
  t.id as team_id,
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
group by t.id, t.league_id, t.season_id;
