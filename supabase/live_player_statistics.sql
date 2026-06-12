-- Count player statistics from completed individual games immediately.
-- A game becomes stat-eligible once it has a winner, even if the wider fixture is still live.

create or replace view public.player_statistics as
with appearances as (
  select
    g.id as game_id,
    unnest(array[g.home_player_1_id, g.home_player_2_id, g.away_player_1_id, g.away_player_2_id]) as person_id,
    g.winner_team_id
  from public.game g
  join public.match m on m.id = g.match_id
  join public.fixture f on f.id = m.fixture_id
  where g.winner_team_id is not null
)
select
  p.id as person_id,
  count(a.game_id) as games_played,
  count(a.game_id) filter (
    where exists (
      select 1 from public.team_membership tm
      where tm.person_id = p.id and tm.team_id = a.winner_team_id
    )
  ) as games_won,
  max(b.break_value) as highest_break,
  count(b.id) as total_breaks,
  count(b.id) filter (where b.break_value >= 50) as fifty_plus_breaks,
  count(b.id) filter (where b.break_value >= 100) as century_breaks
from public.person p
left join appearances a on a.person_id = p.id
left join public.break b on b.player_id = p.id
group by p.id;
