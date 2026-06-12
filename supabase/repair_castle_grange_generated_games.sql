-- Repair the current 2026/27 Castle A v Grange A generated match card so
-- game player ids match the saved lineup slots.

with target_fixture as (
  select f.id
  from public.fixture f
  join public.season s on s.id = f.season_id
  join public.league l on l.id = f.league_id
  join public.team ht on ht.id = f.home_team_id
  join public.team at on at.id = f.away_team_id
  where s.name = '2026/27'
    and l.name = 'A League'
    and ht.name = 'Castle A'
    and at.name = 'Grange A'
  limit 1
),
lineup_slots as (
  select
    m.id as match_id,
    fls.slot_number,
    fls.game_type,
    home_slot.player_1_id as home_player_1_id,
    home_slot.player_2_id as home_player_2_id,
    away_slot.player_1_id as away_player_1_id,
    away_slot.player_2_id as away_player_2_id
  from target_fixture tf
  join public.match m on m.fixture_id = tf.id
  join public.fixture f on f.id = tf.id
  join public.fixture_lineup home_lineup on home_lineup.fixture_id = f.id and home_lineup.team_id = f.home_team_id
  join public.fixture_lineup away_lineup on away_lineup.fixture_id = f.id and away_lineup.team_id = f.away_team_id
  join public.fixture_lineup_slot fls on fls.lineup_id = home_lineup.id
  join public.fixture_lineup_slot home_slot on home_slot.lineup_id = home_lineup.id and home_slot.slot_number = fls.slot_number
  join public.fixture_lineup_slot away_slot on away_slot.lineup_id = away_lineup.id and away_slot.slot_number = fls.slot_number
)
update public.game g
set game_type = lineup_slots.game_type,
    home_player_1_id = lineup_slots.home_player_1_id,
    home_player_2_id = case when lineup_slots.game_type = 'Doubles' then lineup_slots.home_player_2_id else null end,
    away_player_1_id = lineup_slots.away_player_1_id,
    away_player_2_id = case when lineup_slots.game_type = 'Doubles' then lineup_slots.away_player_2_id else null end,
    points_awarded = case when lineup_slots.game_type = 'Doubles' then 2 else 1 end
from lineup_slots
where g.match_id = lineup_slots.match_id
  and g.game_number = lineup_slots.slot_number;
