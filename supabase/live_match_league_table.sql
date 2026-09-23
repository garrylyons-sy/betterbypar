-- Include active matches in league tables once at least one frame has a recorded winner.
-- This lets dashboards and league tables move during a match, while avoiding 0-0
-- generated match cards affecting standings before play starts.

create or replace view public.match_points_view as
select
  m.id as match_id,
  f.id as fixture_id,
  f.season_id,
  f.league_id,
  f.home_team_id,
  f.away_team_id,
  case
    when count(g.id) = 0 then m.home_team_score
    else coalesce(sum(g.points_awarded) filter (where g.winner_team_id = f.home_team_id), 0)
  end as home_team_points,
  case
    when count(g.id) = 0 then m.away_team_score
    else coalesce(sum(g.points_awarded) filter (where g.winner_team_id = f.away_team_id), 0)
  end as away_team_points
from public.match m
join public.fixture f on f.id = m.fixture_id
left join public.game g on g.match_id = m.id
where coalesce(f.fixture_type, 'League') = 'League'
  and (
    f.status = 'Completed'
    or exists (
    select 1
    from public.game active_game
    where active_game.match_id = m.id
      and active_game.winner_team_id is not null
    )
  )
group by m.id, f.id, f.season_id, f.league_id, f.home_team_id, f.away_team_id;
