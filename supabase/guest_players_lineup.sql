-- Guest Player support for exceptional lineup selections.
-- Guest Players can affect the team result but do not count in individual stats.

alter table public.fixture_lineup_slot
  add column if not exists player_1_guest_name text,
  add column if not exists player_2_guest_name text,
  add column if not exists player_1_is_guest boolean not null default false,
  add column if not exists player_2_is_guest boolean not null default false,
  add column if not exists player_1_counts_for_stats boolean not null default true,
  add column if not exists player_2_counts_for_stats boolean not null default true;

alter table public.game
  add column if not exists home_player_1_guest_name text,
  add column if not exists home_player_2_guest_name text,
  add column if not exists away_player_1_guest_name text,
  add column if not exists away_player_2_guest_name text,
  add column if not exists home_player_1_is_guest boolean not null default false,
  add column if not exists home_player_2_is_guest boolean not null default false,
  add column if not exists away_player_1_is_guest boolean not null default false,
  add column if not exists away_player_2_is_guest boolean not null default false,
  add column if not exists home_player_1_counts_for_stats boolean not null default true,
  add column if not exists home_player_2_counts_for_stats boolean not null default true,
  add column if not exists away_player_1_counts_for_stats boolean not null default true,
  add column if not exists away_player_2_counts_for_stats boolean not null default true;

comment on column public.fixture_lineup_slot.player_1_is_guest is 'True when the selected player is an exceptional Guest Player for this lineup slot.';
comment on column public.fixture_lineup_slot.player_1_counts_for_stats is 'False for Guest Player appearances so individual stats are not affected.';
comment on column public.game.home_player_1_counts_for_stats is 'False for Guest Player appearances so individual stats are not affected.';

create or replace view public.player_statistics as
with appearances as (
  select
    g.id as game_id,
    player_appearance.person_id,
    player_appearance.team_id,
    g.winner_team_id
  from public.game g
  join public.match m on m.id = g.match_id
  join public.fixture f on f.id = m.fixture_id
  cross join lateral (
    values
      (g.home_player_1_id, f.home_team_id, coalesce(g.home_player_1_counts_for_stats, true)),
      (g.home_player_2_id, f.home_team_id, coalesce(g.home_player_2_counts_for_stats, true)),
      (g.away_player_1_id, f.away_team_id, coalesce(g.away_player_1_counts_for_stats, true)),
      (g.away_player_2_id, f.away_team_id, coalesce(g.away_player_2_counts_for_stats, true))
  ) as player_appearance(person_id, team_id, counts_for_stats)
  where g.winner_team_id is not null
    and coalesce(f.fixture_type, 'League') = 'League'
    and player_appearance.person_id is not null
    and player_appearance.counts_for_stats
),
break_values as (
  select b.*
  from public.break b
  left join public.game g on g.id = b.game_id
  left join public.match m on m.id = g.match_id
  left join public.fixture f on f.id = m.fixture_id
  where f.id is null or coalesce(f.fixture_type, 'League') = 'League'
)
select
  p.id as person_id,
  count(distinct a.game_id) as games_played,
  count(distinct a.game_id) filter (where a.team_id = a.winner_team_id) as games_won,
  max(b.break_value) as highest_break,
  count(distinct b.id) as total_breaks,
  count(distinct b.id) filter (where b.break_value >= 50) as fifty_plus_breaks,
  count(distinct b.id) filter (where b.break_value >= 100) as century_breaks
from public.person p
left join appearances a on a.person_id = p.id
left join break_values b on b.player_id = p.id
group by p.id;

create or replace view public.player_game_result_view
with (security_invoker = true) as
select
  result_source.game_id,
  result_source.season_id,
  s.name as season_name,
  result_source.league_id,
  l.name as league_name,
  result_source.source_fixture_index,
  result_source.source_week,
  result_source.home_team_name,
  result_source.home_team_score,
  result_source.away_team_name,
  result_source.away_team_score,
  result_source.game_number,
  result_source.game_ordinal,
  result_source.is_doubles_partner_row,
  result_source.player_1_id,
  p1.first_name || ' ' || p1.last_name as player_1_name,
  result_source.player_2_id,
  p2.first_name || ' ' || p2.last_name as player_2_name,
  result_source.result,
  case when result_source.result = 1 then result_source.player_1_id else result_source.player_2_id end as winner_player_id,
  case when result_source.result = 1 then result_source.player_2_id else result_source.player_1_id end as loser_player_id,
  case when result_source.result = 1 then p1.first_name || ' ' || p1.last_name else p2.first_name || ' ' || p2.last_name end as winner_name,
  case when result_source.result = 1 then p2.first_name || ' ' || p2.last_name else p1.first_name || ' ' || p1.last_name end as loser_name,
  result_source.source_key
from (
  select
    pgr.game_id,
    pgr.season_id,
    pgr.league_id,
    pgr.source_fixture_index,
    pgr.source_week,
    pgr.home_team_name,
    pgr.home_team_score,
    pgr.away_team_name,
    pgr.away_team_score,
    pgr.game_number,
    pgr.game_ordinal,
    pgr.is_doubles_partner_row,
    pgr.player_1_id,
    pgr.player_2_id,
    pgr.result,
    pgr.source_key
  from public.player_game_result pgr
  union all
  select
    g.id as game_id,
    f.season_id,
    f.league_id,
    null::integer as source_fixture_index,
    coalesce(fw.week_label, to_char(f.fixture_date, 'DD Mon YYYY')) as source_week,
    ht.name as home_team_name,
    m.home_team_score,
    at.name as away_team_name,
    m.away_team_score,
    g.game_number,
    g.game_number as game_ordinal,
    false as is_doubles_partner_row,
    player_pair.player_1_id,
    player_pair.player_2_id,
    case when player_pair.player_1_team_id = g.winner_team_id then 1 else 0 end as result,
    'live-' || g.id::text || '-' || player_pair.player_1_id::text || '-' || player_pair.player_2_id::text as source_key
  from public.game g
  join public.match m on m.id = g.match_id
  join public.fixture f on f.id = m.fixture_id
  join public.team ht on ht.id = f.home_team_id
  join public.team at on at.id = f.away_team_id
  left join public.fixture_week_match fwm on fwm.match_id = m.id
  left join public.fixture_week fw on fw.id = fwm.week_id
  cross join lateral (
    values
      (g.home_player_1_id, g.away_player_1_id, f.home_team_id, coalesce(g.home_player_1_counts_for_stats, true), coalesce(g.away_player_1_counts_for_stats, true)),
      (g.home_player_2_id, g.away_player_2_id, f.home_team_id, coalesce(g.home_player_2_counts_for_stats, true), coalesce(g.away_player_2_counts_for_stats, true)),
      (g.away_player_1_id, g.home_player_1_id, f.away_team_id, coalesce(g.away_player_1_counts_for_stats, true), coalesce(g.home_player_1_counts_for_stats, true)),
      (g.away_player_2_id, g.home_player_2_id, f.away_team_id, coalesce(g.away_player_2_counts_for_stats, true), coalesce(g.home_player_2_counts_for_stats, true))
  ) as player_pair(player_1_id, player_2_id, player_1_team_id, player_1_counts_for_stats, player_2_counts_for_stats)
  where g.winner_team_id is not null
    and coalesce(f.fixture_type, 'League') = 'League'
    and player_pair.player_1_id is not null
    and player_pair.player_2_id is not null
    and player_pair.player_1_counts_for_stats
    and player_pair.player_2_counts_for_stats
    and not exists (
      select 1
      from public.player_game_result imported
      where imported.game_id = g.id
    )
) result_source
join public.season s on s.id = result_source.season_id
join public.league l on l.id = result_source.league_id
join public.person p1 on p1.id = result_source.player_1_id
join public.person p2 on p2.id = result_source.player_2_id;
