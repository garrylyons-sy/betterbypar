-- Simulate full 2026/27 interclub results across all leagues.
-- This keeps fixtures/fixture weeks in place, but replaces generated 2026/27
-- match scores, games, lineups and breaks with fresh simulated data.

begin;

create temporary table _target_fixtures on commit drop as
select
  f.id as fixture_id,
  f.season_id,
  f.league_id,
  l.name as league_name,
  f.fixture_date,
  f.home_team_id,
  f.away_team_id
from public.fixture f
join public.season s on s.id = f.season_id
join public.league l on l.id = f.league_id
where s.name = '2026/27'
  and coalesce(f.fixture_type, 'League') = 'League';

delete from public.break b
where b.game_id in (
  select g.id
  from public.game g
  join public.match m on m.id = g.match_id
  join _target_fixtures tf on tf.fixture_id = m.fixture_id
)
or b.season_id in (select distinct season_id from _target_fixtures);

delete from public.match_lineup ml
where ml.match_id in (
  select m.id
  from public.match m
  join _target_fixtures tf on tf.fixture_id = m.fixture_id
);

delete from public.fixture_lineup fl
where fl.fixture_id in (select fixture_id from _target_fixtures);

delete from public.game g
where g.match_id in (
  select m.id
  from public.match m
  join _target_fixtures tf on tf.fixture_id = m.fixture_id
);

delete from public.match m
where m.fixture_id in (select fixture_id from _target_fixtures);

update public.fixture f
set status = 'Scheduled'::public.fixture_status
where f.id in (select fixture_id from _target_fixtures);

create temporary table _fixture_teams on commit drop as
select distinct
  t.id as team_id,
  t.club_id,
  t.league_id,
  t.name as team_name
from public.team t
join (
  select home_team_id as team_id from _target_fixtures
  union
  select away_team_id as team_id from _target_fixtures
) ft on ft.team_id = t.id;

create temporary table _existing_rosters on commit drop as
select distinct ft.team_id, ptr.person_id
from _fixture_teams ft
join public.person_team_role ptr
  on ptr.club_id = ft.club_id
 and ptr.league_id = ft.league_id
 and ptr.team_name = ft.team_name
 and ptr.role = 'Player'
 and ptr.active = true
union
select distinct ft.team_id, tm.person_id
from _fixture_teams ft
join public.team_membership tm
  on tm.team_id = ft.team_id
 and tm.role = 'Player'
 and tm.active = true;

create temporary table _needed_players on commit drop as
select
  ft.team_id,
  ft.club_id,
  ft.league_id,
  ft.team_name,
  generated.slot_number,
  lower(regexp_replace(ft.team_name, '[^a-zA-Z0-9]+', '.', 'g')) as team_slug,
  lower(regexp_replace(ft.team_name, '[^a-zA-Z0-9]+', '.', 'g')) || '.sim' || generated.slot_number || '@notrealmail.com' as email
from _fixture_teams ft
cross join lateral generate_series(
  coalesce((select count(*) from _existing_rosters er where er.team_id = ft.team_id), 0)::integer + 1,
  7
) generated(slot_number);

insert into public.person (first_name, last_name, email, active)
select
  np.team_name,
  'Player ' || np.slot_number::text,
  np.email,
  true
from _needed_players np
on conflict (email) do update
set active = true;

insert into public.club_membership (club_id, person_id, role, active)
select distinct np.club_id, p.id, 'Club Member', true
from _needed_players np
join public.person p on p.email = np.email
on conflict (club_id, person_id, role) do update
set active = true;

insert into public.person_team_role (club_membership_id, person_id, club_id, league_id, team_name, role, active)
select
  cm.id,
  p.id,
  np.club_id,
  np.league_id,
  np.team_name,
  'Player'::public.membership_role,
  true
from _needed_players np
join public.person p on p.email = np.email
join public.club_membership cm
  on cm.club_id = np.club_id
 and cm.person_id = p.id
 and cm.role = 'Club Member'
on conflict (person_id, club_id, league_id, team_name, role) do update
set active = true;

create temporary table _team_players on commit drop as
select distinct ft.team_id, ptr.person_id
from _fixture_teams ft
join public.person_team_role ptr
  on ptr.club_id = ft.club_id
 and ptr.league_id = ft.league_id
 and ptr.team_name = ft.team_name
 and ptr.role = 'Player'
 and ptr.active = true
union
select distinct ft.team_id, tm.person_id
from _fixture_teams ft
join public.team_membership tm
  on tm.team_id = ft.team_id
 and tm.role = 'Player'
 and tm.active = true;

create temporary table _fixture_lineup_slots on commit drop as
with fixture_sides as (
  select fixture_id, league_name, home_team_id as team_id from _target_fixtures
  union all
  select fixture_id, league_name, away_team_id as team_id from _target_fixtures
),
ordered_players as (
  select
    fs.fixture_id,
    fs.team_id,
    tp.person_id,
    row_number() over (
      partition by fs.fixture_id, fs.team_id
      order by md5(fs.fixture_id::text || tp.person_id::text)
    ) as player_order
  from fixture_sides fs
  join _team_players tp on tp.team_id = fs.team_id
),
slot_source as (
  select fixture_id, team_id, 1 as slot_number, 'Singles'::public.game_type as game_type, 1 as p1_order, null::integer as p2_order
  from fixture_sides
  union all
  select fixture_id, team_id, 2, 'Singles'::public.game_type, 2, null from fixture_sides
  where league_name <> 'C League'
  union all
  select fixture_id, team_id, 2, 'Doubles'::public.game_type, 2, 3 from fixture_sides
  where league_name = 'C League'
  union all
  select fixture_id, team_id, 3, 'Doubles'::public.game_type, 3, 4 from fixture_sides
  where league_name <> 'C League'
  union all
  select fixture_id, team_id, 3, 'Singles'::public.game_type, 4, null from fixture_sides
  where league_name = 'C League'
  union all
  select fixture_id, team_id, 4, 'Singles'::public.game_type, 5, null from fixture_sides
  where league_name <> 'C League'
  union all
  select fixture_id, team_id, 4, 'Doubles'::public.game_type, 5, 6 from fixture_sides
  where league_name = 'C League'
  union all
  select fixture_id, team_id, 5, 'Singles'::public.game_type, 6, null from fixture_sides
  where league_name <> 'C League'
  union all
  select fixture_id, team_id, 5, 'Singles'::public.game_type, 7, null from fixture_sides
  where league_name = 'C League'
  union all
  select fixture_id, team_id, 6, 'Singles'::public.game_type, 7, null from fixture_sides
  where league_name <> 'C League'
)
select
  ss.fixture_id,
  ss.team_id,
  ss.slot_number,
  ss.game_type,
  p1.person_id as player_1_id,
  p2.person_id as player_2_id
from slot_source ss
join ordered_players p1
  on p1.fixture_id = ss.fixture_id
 and p1.team_id = ss.team_id
 and p1.player_order = ss.p1_order
left join ordered_players p2
  on p2.fixture_id = ss.fixture_id
 and p2.team_id = ss.team_id
 and p2.player_order = ss.p2_order;

insert into public.fixture_lineup (fixture_id, team_id, status, published_at, updated_at)
select distinct fixture_id, team_id, 'Published', now(), now()
from _fixture_lineup_slots
on conflict (fixture_id, team_id) do update
set status = 'Published',
    published_at = coalesce(public.fixture_lineup.published_at, now()),
    updated_at = now();

insert into public.fixture_lineup_slot (lineup_id, slot_number, game_type, player_1_id, player_2_id)
select
  fl.id,
  fls.slot_number,
  fls.game_type,
  fls.player_1_id,
  fls.player_2_id
from _fixture_lineup_slots fls
join public.fixture_lineup fl
  on fl.fixture_id = fls.fixture_id
 and fl.team_id = fls.team_id
on conflict (lineup_id, slot_number) do update
set game_type = excluded.game_type,
    player_1_id = excluded.player_1_id,
    player_2_id = excluded.player_2_id;

insert into public.match (fixture_id, home_team_score, away_team_score, entered_at)
select fixture_id, 0, 0, now()
from _target_fixtures
on conflict (fixture_id) do update
set home_team_score = 0,
    away_team_score = 0,
    entered_at = now();

insert into public.fixture_week_match (week_id, match_id)
select fw.id, m.id
from _target_fixtures tf
join public.match m on m.fixture_id = tf.fixture_id
join public.fixture_week fw
  on fw.season_id = tf.season_id
 and fw.league_id = tf.league_id
 and fw.starts_on = tf.fixture_date::date
on conflict (match_id) do update
set week_id = excluded.week_id;

create temporary table _game_seed on commit drop as
select
  tf.fixture_id,
  m.id as match_id,
  tf.home_team_id,
  tf.away_team_id,
  home_slot.slot_number as game_number,
  home_slot.game_type,
  case when home_slot.game_type = 'Doubles' then 2 else 1 end as points_awarded,
  random() < 0.5 as home_wins,
  (50 + floor(random() * 46))::integer as winner_score,
  floor(random() * 49)::integer as loser_score
from _target_fixtures tf
join public.match m on m.fixture_id = tf.fixture_id
join _fixture_lineup_slots home_slot
  on home_slot.fixture_id = tf.fixture_id
 and home_slot.team_id = tf.home_team_id;

insert into public.game (
  match_id,
  game_type,
  game_number,
  home_player_1_id,
  home_player_2_id,
  away_player_1_id,
  away_player_2_id,
  home_score,
  away_score,
  winner_team_id,
  points_awarded
)
select
  seed.match_id,
  seed.game_type,
  seed.game_number,
  home_slot.player_1_id,
  home_slot.player_2_id,
  away_slot.player_1_id,
  away_slot.player_2_id,
  case when seed.home_wins then seed.winner_score else seed.loser_score end,
  case when seed.home_wins then seed.loser_score else seed.winner_score end,
  case when seed.home_wins then seed.home_team_id else seed.away_team_id end,
  seed.points_awarded
from _game_seed seed
join _fixture_lineup_slots home_slot
  on home_slot.fixture_id = seed.fixture_id
 and home_slot.team_id = seed.home_team_id
 and home_slot.slot_number = seed.game_number
join _fixture_lineup_slots away_slot
  on away_slot.fixture_id = seed.fixture_id
 and away_slot.team_id = seed.away_team_id
 and away_slot.slot_number = seed.game_number
on conflict (match_id, game_number) do update
set home_player_1_id = excluded.home_player_1_id,
    home_player_2_id = excluded.home_player_2_id,
    away_player_1_id = excluded.away_player_1_id,
    away_player_2_id = excluded.away_player_2_id,
    home_score = excluded.home_score,
    away_score = excluded.away_score,
    winner_team_id = excluded.winner_team_id,
    points_awarded = excluded.points_awarded;

select public.refresh_match_team_points(m.id)
from public.match m
join _target_fixtures tf on tf.fixture_id = m.fixture_id;

update public.fixture f
set status = 'Completed'::public.fixture_status
where f.id in (select fixture_id from _target_fixtures);

create temporary table _break_seed on commit drop as
select
  g.id as game_id,
  case
    when random() < 0.65 then coalesce(g.home_player_1_id, g.away_player_1_id)
    when random() < 0.80 then coalesce(g.away_player_1_id, g.home_player_1_id)
    when random() < 0.90 then coalesce(g.home_player_2_id, g.home_player_1_id, g.away_player_1_id)
    else coalesce(g.away_player_2_id, g.away_player_1_id, g.home_player_1_id)
  end as player_id,
  case
    when random() < 0.02 then (120 + floor(random() * 28))::integer
    when random() < 0.09 then (80 + floor(random() * 40))::integer
    else (20 + floor(random() * 60))::integer
  end as break_value
from public.game g
join public.match m on m.id = g.match_id
join _target_fixtures tf on tf.fixture_id = m.fixture_id
where random() < 0.22;

insert into public.break (game_id, player_id, break_value, source_label, source_key, recorded_at)
select
  game_id,
  player_id,
  break_value,
  '2026/27 simulation',
  'sim-2026-27-' || game_id::text,
  now()
from _break_seed
where player_id is not null
on conflict (source_key) do update
set player_id = excluded.player_id,
    break_value = excluded.break_value,
    recorded_at = excluded.recorded_at;

commit;
