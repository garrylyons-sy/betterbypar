create extension if not exists pgcrypto;

create type invitation_status as enum ('Pending', 'Accepted', 'Expired', 'Revoked');
create type membership_role as enum ('Player', 'Manager', 'Assistant Manager');
create type fixture_status as enum ('Scheduled', 'Completed', 'Cancelled');
create type game_type as enum ('Singles', 'Doubles');
create type invitation_request_status as enum ('Pending', 'Approved', 'Rejected', 'Cancelled');
create type user_activity_type as enum ('Login', 'Page Visit');

create table public.person (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text unique,
  phone text,
  profile_image text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_account (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.person(id) on delete cascade,
  username text unique not null,
  password_hash text,
  google_id text unique,
  last_login timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.person is 'Human/player identity. Historical imports create person ids for players who appear in matches, even when they do not have app login access.';
comment on table public.user_account is 'Authentication linkage only. Rows are created when a person activates an invitation or completes the approved registration flow, not by historical match imports.';

create table public.app_session (
  id text primary key,
  user_account_id uuid not null references public.user_account(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index app_session_user_account_id_idx on public.app_session (user_account_id);
create index app_session_expires_at_idx on public.app_session (expires_at);

comment on table public.app_session is 'App-owned login sessions. The browser stores only this id in an HTTP-only cookie; Supabase Auth is not used for application login.';

create table public.app_operator (
  person_id uuid primary key references public.person(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.app_operator is 'Private backend/operator access for league operations such as invitations, permissions and audit logs. This is not a player or manager role.';

create table public.club (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  venue text,
  address text,
  logo_path text,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true
);

create table public.club_table (
  table_id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete cascade,
  table_name text not null,
  table_description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (club_id, table_name),
  unique (table_id, club_id)
);

comment on table public.club_table is 'Snooker tables available for member booking at a club.';

create table public.season (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date,
  ends_on date,
  active boolean not null default false
);

create table public.league (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('A League', 'B League', 'C League')),
  playing_day text not null
);

create table public.team (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete restrict,
  league_id uuid not null references public.league(id) on delete restrict,
  season_id uuid not null references public.season(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  unique (league_id, season_id, name)
);

create table public.team_membership (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.team(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete cascade,
  role membership_role not null,
  joined_date date not null default current_date,
  active boolean not null default true,
  unique (team_id, person_id, role)
);

create table public.club_membership (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete cascade,
  role text not null default 'Club Member' check (role = 'Club Member'),
  joined_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (club_id, person_id, role)
);

comment on table public.club_membership is 'Club-level membership for people who can receive club messages and book club tables without belonging to a league team.';

create table public.invitation (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invitation_code text not null unique,
  invited_person_name text not null,
  invited_club_id uuid references public.club(id) on delete set null,
  invited_role membership_role not null,
  status invitation_status not null default 'Pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.person(id) on delete set null
);

create table public.invitation_membership (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitation(id) on delete cascade,
  team_id uuid not null references public.team(id) on delete cascade,
  role membership_role not null,
  unique (invitation_id, team_id, role)
);

comment on table public.invitation_membership is 'Team-role grants attached to an account invitation. A single person can be invited as a player in one team and manager or assistant manager in another.';

create table public.invitation_request (
  id uuid primary key default gen_random_uuid(),
  requested_person_name text not null,
  email text not null,
  club_id uuid not null references public.club(id) on delete restrict,
  team_id uuid not null references public.team(id) on delete restrict,
  requested_role membership_role not null default 'Player' check (requested_role = 'Player'),
  status invitation_request_status not null default 'Pending',
  message text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.person(id) on delete set null,
  check (position('@' in email) > 1)
);

comment on table public.invitation_request is 'Public player-only invite requests. Manager and assistant manager invitations are handled through backend invitation membership management.';

create table public.user_activity_log (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  person_id uuid references public.person(id) on delete set null,
  activity_type user_activity_type not null,
  page_path text,
  page_label text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index user_activity_log_auth_user_id_created_at_idx on public.user_activity_log (auth_user_id, created_at desc);
create index user_activity_log_person_id_created_at_idx on public.user_activity_log (person_id, created_at desc);

comment on table public.user_activity_log is 'Audit log for authenticated user logins and page visits.';

create table public.table_booking (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete cascade,
  table_id uuid not null,
  person_id uuid not null references public.person(id) on delete cascade,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.person(id) on delete set null,
  foreign key (table_id, club_id) references public.club_table(table_id, club_id) on delete cascade,
  check (start_time >= time '11:00' and start_time < time '23:00'),
  check (end_time = start_time + interval '1 hour'),
  check (cancelled_at is null or cancelled_by is not null)
);

create unique index table_booking_active_slot_idx
on public.table_booking (table_id, booking_date, start_time)
where cancelled_at is null;

create index table_booking_club_date_idx on public.table_booking (club_id, booking_date, start_time);
create index table_booking_person_date_idx on public.table_booking (person_id, booking_date desc);

comment on table public.table_booking is 'One-hour member snooker table bookings. Active bookings are unique per table, date and start time.';

create table public.fixture (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.season(id) on delete cascade,
  league_id uuid not null references public.league(id) on delete restrict,
  fixture_date timestamptz not null,
  home_team_id uuid not null references public.team(id) on delete restrict,
  away_team_id uuid not null references public.team(id) on delete restrict,
  status fixture_status not null default 'Scheduled',
  check (home_team_id <> away_team_id)
);

create table public.match (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null unique references public.fixture(id) on delete cascade,
  home_team_score integer not null default 0 check (home_team_score between 0 and 7),
  away_team_score integer not null default 0 check (away_team_score between 0 and 7),
  entered_by uuid references public.person(id) on delete set null,
  entered_at timestamptz not null default now(),
  check (home_team_score + away_team_score <= 7)
);

create table public.fixture_week (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.season(id) on delete cascade,
  league_id uuid not null references public.league(id) on delete cascade,
  week_number integer not null check (week_number > 0),
  week_label text not null,
  starts_on date,
  unique (season_id, league_id, week_number)
);

create table public.fixture_week_match (
  week_id uuid not null references public.fixture_week(id) on delete cascade,
  match_id uuid not null references public.match(id) on delete cascade,
  primary key (week_id, match_id),
  unique (match_id)
);

comment on table public.fixture_week is 'League fixture round/week grouping. One week can contain multiple matches for the same league and season.';
comment on table public.fixture_week_match is 'Join table linking a fixture week to the matches played in that week.';

create table public.game (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.match(id) on delete cascade,
  game_type game_type not null,
  game_number integer not null check (game_number between 1 and 6),
  home_player_1_id uuid references public.person(id) on delete restrict,
  home_player_2_id uuid references public.person(id) on delete restrict,
  away_player_1_id uuid references public.person(id) on delete restrict,
  away_player_2_id uuid references public.person(id) on delete restrict,
  home_score integer not null default 0,
  away_score integer not null default 0,
  winner_team_id uuid references public.team(id) on delete restrict,
  points_awarded integer not null check (points_awarded in (1, 2)),
  unique (match_id, game_number),
  check ((game_type = 'Singles' and game_number between 1 and 5 and points_awarded = 1) or (game_type = 'Doubles' and game_number = 6 and points_awarded = 2))
);

comment on table public.game is 'Each row is one snooker frame. Singles frames award 1 league point to the frame winner; the doubles frame awards 2 league points to the frame winner.';
comment on column public.game.home_score is 'Snooker points scored by the home side/player(s) in this single frame.';
comment on column public.game.away_score is 'Snooker points scored by the away side/player(s) in this single frame.';
comment on column public.game.points_awarded is 'League points awarded for winning this frame: 1 for singles, 2 for doubles.';

create table public.player_game_result (
  game_id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.season(id) on delete cascade,
  league_id uuid not null references public.league(id) on delete restrict,
  source_fixture_index integer,
  source_week text,
  home_team_name text,
  home_team_score integer check (home_team_score between 0 and 7),
  away_team_name text,
  away_team_score integer check (away_team_score between 0 and 7),
  game_number integer check (game_number between 1 and 6),
  game_ordinal integer check (game_ordinal between 1 and 7),
  is_doubles_partner_row boolean not null default false,
  player_1_id uuid not null references public.person(id) on delete restrict,
  player_2_id uuid not null references public.person(id) on delete restrict,
  result integer not null check (result in (0, 1)),
  source_key text not null unique,
  created_at timestamptz not null default now(),
  check (player_1_id <> player_2_id)
);

create index player_game_result_player_1_id_idx on public.player_game_result (player_1_id);
create index player_game_result_player_2_id_idx on public.player_game_result (player_2_id);
create index player_game_result_season_league_idx on public.player_game_result (season_id, league_id);

comment on table public.player_game_result is 'One imported player-v-player game result. result is from player_1_id perspective: 1 = player_1 won, 0 = player_1 lost.';
comment on column public.player_game_result.game_id is 'Unique imported game id for a single player-v-player result row.';
comment on column public.player_game_result.player_1_id is 'First player in the source row. The result column belongs to this player.';
comment on column public.player_game_result.player_2_id is 'Opponent player in the source row.';
comment on column public.player_game_result.result is 'Player 1 result: 1 means player_1_id won; 0 means player_1_id lost.';

create table public.match_lineup (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.match(id) on delete cascade,
  team_id uuid not null references public.team(id) on delete cascade,
  player_id uuid not null references public.person(id) on delete cascade,
  game_number integer not null check (game_number between 1 and 6),
  created_at timestamptz not null default now(),
  unique (match_id, team_id, player_id, game_number)
);

create table public.break (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.game(id) on delete cascade,
  season_id uuid references public.season(id) on delete cascade,
  league_id uuid references public.league(id) on delete restrict,
  player_id uuid not null references public.person(id) on delete cascade,
  break_value integer not null check (break_value between 1 and 147),
  source_label text,
  source_key text unique,
  recorded_at timestamptz not null default now(),
  check (game_id is not null or (season_id is not null and league_id is not null))
);

comment on table public.break is 'Individual player breaks. Live scoring rows link to a game; historical imports without frame detail link to a season and league with a source key.';
comment on column public.break.game_id is 'Set when the exact frame/game is known.';
comment on column public.break.season_id is 'Set for imported historical breaks when the exact game is unknown.';
comment on column public.break.league_id is 'Set for imported historical breaks when the exact game is unknown.';
comment on column public.break.source_key is 'Stable idempotency key for imported break rows.';

create table public.conversation (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.person(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.conversation_participant (
  conversation_id uuid not null references public.conversation(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, person_id)
);

create table public.message (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversation(id) on delete cascade,
  sender_person_id uuid not null references public.person(id) on delete cascade,
  message_body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

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
where f.status = 'Completed'
group by m.id, f.id, f.season_id, f.league_id, f.home_team_id, f.away_team_id;

create or replace function public.refresh_match_team_points(match_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  home_points integer;
  away_points integer;
begin
  select
    coalesce(sum(g.points_awarded) filter (where g.winner_team_id = f.home_team_id), 0),
    coalesce(sum(g.points_awarded) filter (where g.winner_team_id = f.away_team_id), 0)
  into home_points, away_points
  from public.match m
  join public.fixture f on f.id = m.fixture_id
  left join public.game g on g.match_id = m.id
  where m.id = match_uuid
  group by m.id;

  update public.match
  set home_team_score = coalesce(home_points, 0),
      away_team_score = coalesce(away_points, 0)
  where id = match_uuid;
end;
$$;

create or replace function public.refresh_match_team_points_from_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_match_team_points(old.match_id);
    return old;
  end if;

  perform public.refresh_match_team_points(new.match_id);

  if tg_op = 'UPDATE' and old.match_id <> new.match_id then
    perform public.refresh_match_team_points(old.match_id);
  end if;

  return new;
end;
$$;

drop trigger if exists refresh_match_team_points_after_game_change on public.game;

create trigger refresh_match_team_points_after_game_change
after insert or update or delete on public.game
for each row execute function public.refresh_match_team_points_from_game();

create or replace view public.league_table_view as
select
  row_number() over (
    partition by t.league_id, t.season_id
    order by
      coalesce(sum(case when mp.home_team_id = t.id then mp.home_team_points when mp.away_team_id = t.id then mp.away_team_points else 0 end), 0) desc,
      coalesce(sum(case when mp.home_team_id = t.id then mp.home_team_points - mp.away_team_points when mp.away_team_id = t.id then mp.away_team_points - mp.home_team_points else 0 end), 0) desc,
      coalesce(sum(case when mp.home_team_points > mp.away_team_points and mp.home_team_id = t.id then 1 when mp.away_team_points > mp.home_team_points and mp.away_team_id = t.id then 1 else 0 end), 0) desc,
      t.name asc
  ) as position,
  t.id as team_id,
  t.league_id,
  t.season_id,
  count(mp.match_id) as matches_played,
  coalesce(sum(case when mp.home_team_points > mp.away_team_points and mp.home_team_id = t.id then 1 when mp.away_team_points > mp.home_team_points and mp.away_team_id = t.id then 1 else 0 end), 0) as matches_won,
  coalesce(sum(case when mp.home_team_points < mp.away_team_points and mp.home_team_id = t.id then 1 when mp.away_team_points < mp.home_team_points and mp.away_team_id = t.id then 1 else 0 end), 0) as matches_lost,
  coalesce(sum(case when mp.home_team_id = t.id then mp.home_team_points when mp.away_team_id = t.id then mp.away_team_points else 0 end), 0) as points_for,
  coalesce(sum(case when mp.home_team_id = t.id then mp.away_team_points when mp.away_team_id = t.id then mp.home_team_points else 0 end), 0) as points_against,
  coalesce(sum(case when mp.home_team_id = t.id then mp.home_team_points when mp.away_team_id = t.id then mp.away_team_points else 0 end), 0) as league_points
from public.team t
left join public.match_points_view mp on mp.home_team_id = t.id or mp.away_team_id = t.id
group by t.id, t.league_id, t.season_id;

create or replace view public.player_statistics as
with appearances as (
  select g.id as game_id, unnest(array[g.home_player_1_id, g.home_player_2_id, g.away_player_1_id, g.away_player_2_id]) as person_id, g.winner_team_id
  from public.game g
  join public.match m on m.id = g.match_id
  join public.fixture f on f.id = m.fixture_id
  where f.status = 'Completed'
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

create or replace view public.player_break_leaderboard_view as
select
  row_number() over (
    partition by coalesce(b.season_id, f.season_id), coalesce(b.league_id, f.league_id)
    order by b.break_value desc, p.last_name, p.first_name, b.recorded_at
  ) as position,
  b.id as break_id,
  coalesce(b.season_id, f.season_id) as season_id,
  s.name as season_name,
  coalesce(b.league_id, f.league_id) as league_id,
  l.name as league_name,
  b.player_id,
  p.first_name,
  p.last_name,
  b.break_value,
  b.game_id,
  b.source_label,
  b.recorded_at
from public.break b
join public.person p on p.id = b.player_id
left join public.game g on g.id = b.game_id
left join public.match m on m.id = g.match_id
left join public.fixture f on f.id = m.fixture_id
left join public.season s on s.id = coalesce(b.season_id, f.season_id)
left join public.league l on l.id = coalesce(b.league_id, f.league_id);

create or replace view public.player_game_result_view
with (security_invoker = true) as
select
  pgr.game_id,
  pgr.season_id,
  s.name as season_name,
  pgr.league_id,
  l.name as league_name,
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
  p1.first_name || ' ' || p1.last_name as player_1_name,
  pgr.player_2_id,
  p2.first_name || ' ' || p2.last_name as player_2_name,
  pgr.result,
  case when pgr.result = 1 then pgr.player_1_id else pgr.player_2_id end as winner_player_id,
  case when pgr.result = 1 then pgr.player_2_id else pgr.player_1_id end as loser_player_id,
  case when pgr.result = 1 then p1.first_name || ' ' || p1.last_name else p2.first_name || ' ' || p2.last_name end as winner_name,
  case when pgr.result = 1 then p2.first_name || ' ' || p2.last_name else p1.first_name || ' ' || p1.last_name end as loser_name,
  pgr.source_key
from public.player_game_result pgr
join public.season s on s.id = pgr.season_id
join public.league l on l.id = pgr.league_id
join public.person p1 on p1.id = pgr.player_1_id
join public.person p2 on p2.id = pgr.player_2_id;

create or replace view public.club_team_structure_view as
select
  c.id as club_id,
  c.name as club_name,
  s.id as season_id,
  s.name as season_name,
  count(t.id) as team_count,
  array_agg(t.name order by l.name, t.name) filter (where t.id is not null) as teams,
  array_agg(l.name order by l.name, t.name) filter (where t.id is not null) as leagues
from public.club c
cross join public.season s
left join public.team t on t.club_id = c.id and t.season_id = s.id and t.active = true
left join public.league l on l.id = t.league_id
where c.active = true
group by c.id, c.name, s.id, s.name;

create or replace view public.user_team_context_view
with (security_invoker = true) as
select
  ua.id as auth_user_id,
  p.id as person_id,
  p.first_name,
  p.last_name,
  ua.username,
  tm.id as membership_id,
  tm.role,
  t.id as team_id,
  t.name as team_name,
  c.id as club_id,
  c.name as club_name,
  c.logo_path,
  c.primary_color,
  c.accent_color,
  l.id as league_id,
  l.name as league_name,
  s.id as season_id,
  s.name as season_name
from public.user_account ua
join public.person p on p.id = ua.person_id
join public.team_membership tm on tm.person_id = p.id and tm.active = true
join public.team t on t.id = tm.team_id and t.active = true
join public.club c on c.id = t.club_id and c.active = true
join public.league l on l.id = t.league_id
join public.season s on s.id = t.season_id
where ua.active = true;

create or replace view public.membership_management_view as
select
  p.id as person_id,
  p.first_name,
  p.last_name,
  p.email,
  p.phone,
  p.active as person_active,
  tm.id as membership_id,
  tm.role,
  tm.joined_date,
  tm.active as membership_active,
  t.id as team_id,
  t.name as team_name,
  c.id as club_id,
  c.name as club_name,
  l.id as league_id,
  l.name as league_name,
  s.id as season_id,
  s.name as season_name
from public.person p
left join public.team_membership tm on tm.person_id = p.id
left join public.team t on t.id = tm.team_id
left join public.club c on c.id = t.club_id
left join public.league l on l.id = t.league_id
left join public.season s on s.id = t.season_id;

comment on view public.membership_management_view is 'Backend management view for people and their Player, Manager and Assistant Manager team memberships.';

create or replace function public.resolve_login_identifier(login_identifier text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when position('@' in login_identifier) > 1 then lower(trim(login_identifier))
    else (
      select lower(p.email)
      from public.user_account ua
      join public.person p on p.id = ua.person_id
      where lower(ua.username) = lower(trim(login_identifier))
        and ua.active = true
        and p.active = true
      limit 1
    )
  end
$$;

create or replace function public.accept_invitation_for_current_user(invitation_code_input text, username_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_auth_user uuid := auth.uid();
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  invitation_record public.invitation%rowtype;
  target_person_id uuid;
  first_name_input text;
  last_name_input text;
begin
  if current_auth_user is null then
    raise exception 'You must be signed in before activating an invitation.';
  end if;

  if trim(coalesce(username_input, '')) = '' then
    raise exception 'User ID is required.';
  end if;

  select *
  into invitation_record
  from public.invitation
  where invitation_code = trim(invitation_code_input)
  for update;

  if not found then
    raise exception 'Invitation code not found.';
  end if;

  if invitation_record.status <> 'Pending' then
    raise exception 'Invitation is not pending.';
  end if;

  if invitation_record.expires_at <= now() then
    update public.invitation
    set status = 'Expired'
    where id = invitation_record.id;
    raise exception 'Invitation has expired.';
  end if;

  if current_email = '' or lower(invitation_record.email) <> current_email then
    raise exception 'Signed-in email does not match this invitation.';
  end if;

  if not exists (
    select 1
    from public.invitation_membership
    where invitation_id = invitation_record.id
  ) then
    raise exception 'Invitation has no team role attached.';
  end if;

  if exists (
    select 1
    from public.user_account
    where lower(username) = lower(trim(username_input))
      and id <> current_auth_user
  ) then
    raise exception 'User ID is already taken.';
  end if;

  first_name_input := split_part(trim(invitation_record.invited_person_name), ' ', 1);
  last_name_input := nullif(trim(substr(trim(invitation_record.invited_person_name), length(first_name_input) + 1)), '');

  select id
  into target_person_id
  from public.person
  where lower(email) = current_email
  limit 1;

  if target_person_id is null then
    select id
    into target_person_id
    from public.person
    where email is null
      and lower(first_name) = lower(first_name_input)
      and lower(last_name) = lower(coalesce(last_name_input, ''))
    limit 1;
  end if;

  if target_person_id is null then
    insert into public.person (first_name, last_name, email, active)
    values (first_name_input, coalesce(last_name_input, ''), current_email, true)
    returning id into target_person_id;
  else
    update public.person
    set email = coalesce(email, current_email),
        active = true
    where id = target_person_id;
  end if;

  insert into public.user_account (id, person_id, username, last_login, active)
  values (current_auth_user, target_person_id, trim(username_input), now(), true)
  on conflict (id) do update
  set person_id = excluded.person_id,
      username = excluded.username,
      last_login = now(),
      active = true;

  insert into public.team_membership (team_id, person_id, role, active)
  select im.team_id, target_person_id, im.role, true
  from public.invitation_membership im
  where im.invitation_id = invitation_record.id
  on conflict (team_id, person_id, role) do update
  set active = true;

  update public.invitation
  set status = 'Accepted',
      accepted_at = now()
  where id = invitation_record.id;

  return target_person_id;
end;
$$;

create or replace function public.accept_pending_invitation_for_current_user(username_input text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_auth_user uuid := auth.uid();
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  invitation_record public.invitation%rowtype;
  base_username text;
  next_username text;
  suffix_number integer := 1;
begin
  if current_auth_user is null then
    raise exception 'You must be signed in before activating an invitation.';
  end if;

  if current_email = '' then
    return null;
  end if;

  select *
  into invitation_record
  from public.invitation
  where lower(email) = current_email
    and status = 'Pending'
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  if invitation_record.expires_at <= now() then
    update public.invitation
    set status = 'Expired'
    where id = invitation_record.id;
    return null;
  end if;

  base_username := lower(regexp_replace(coalesce(nullif(trim(username_input), ''), split_part(current_email, '@', 1)), '[^a-z0-9_]+', '', 'g'));

  if base_username = '' then
    base_username := 'player';
  end if;

  next_username := base_username;

  while exists (
    select 1
    from public.user_account
    where lower(username) = lower(next_username)
      and id <> current_auth_user
  ) loop
    suffix_number := suffix_number + 1;
    next_username := left(base_username, 20) || '_' || suffix_number::text;
  end loop;

  return public.accept_invitation_for_current_user(invitation_record.invitation_code, next_username);
end;
$$;

create or replace function public.player_invite_team_options()
returns table (
  club_id uuid,
  club_name text,
  team_id uuid,
  team_name text,
  league_name text,
  season_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as club_id,
    c.name as club_name,
    t.id as team_id,
    t.name as team_name,
    l.name as league_name,
    s.name as season_name
  from public.team t
  join public.club c on c.id = t.club_id
  join public.league l on l.id = t.league_id
  join public.season s on s.id = t.season_id
  where t.active = true
    and c.active = true
    and s.active = true
  order by c.name, l.name, t.name;
$$;

create or replace function public.request_player_invitation(
  requested_person_name_input text,
  email_input text,
  team_id_input uuid,
  message_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id uuid;
  target_club_id uuid;
begin
  if trim(coalesce(requested_person_name_input, '')) = '' then
    raise exception 'Name is required.';
  end if;

  if position('@' in coalesce(email_input, '')) <= 1 then
    raise exception 'A valid email is required.';
  end if;

  select club_id
  into target_club_id
  from public.team
  where id = team_id_input
    and active = true;

  if target_club_id is null then
    raise exception 'Team not found.';
  end if;

  insert into public.invitation_request (
    requested_person_name,
    email,
    club_id,
    team_id,
    requested_role,
    message
  )
  values (
    trim(requested_person_name_input),
    lower(trim(email_input)),
    target_club_id,
    team_id_input,
    'Player',
    nullif(trim(coalesce(message_input, '')), '')
  )
  returning id into request_id;

  return request_id;
end;
$$;

create or replace function public.record_user_login(user_agent_input text default null, metadata_input jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_auth_user uuid := auth.uid();
  current_person_id uuid;
  log_id uuid;
begin
  if current_auth_user is null then
    raise exception 'You must be signed in to record activity.';
  end if;

  select person_id
  into current_person_id
  from public.user_account
  where id = current_auth_user
    and active = true;

  update public.user_account
  set last_login = now()
  where id = current_auth_user;

  insert into public.user_activity_log (
    auth_user_id,
    person_id,
    activity_type,
    page_path,
    page_label,
    user_agent,
    metadata
  )
  values (
    current_auth_user,
    current_person_id,
    'Login',
    null,
    null,
    user_agent_input,
    coalesce(metadata_input, '{}'::jsonb)
  )
  returning id into log_id;

  return log_id;
end;
$$;

create or replace function public.record_page_visit(
  page_path_input text,
  page_label_input text default null,
  user_agent_input text default null,
  metadata_input jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_auth_user uuid := auth.uid();
  current_person_id uuid;
  log_id uuid;
begin
  if current_auth_user is null then
    raise exception 'You must be signed in to record activity.';
  end if;

  select person_id
  into current_person_id
  from public.user_account
  where id = current_auth_user
    and active = true;

  insert into public.user_activity_log (
    auth_user_id,
    person_id,
    activity_type,
    page_path,
    page_label,
    user_agent,
    metadata
  )
  values (
    current_auth_user,
    current_person_id,
    'Page Visit',
    left(trim(coalesce(page_path_input, '/')), 500),
    nullif(left(trim(coalesce(page_label_input, '')), 120), ''),
    user_agent_input,
    coalesce(metadata_input, '{}'::jsonb)
  )
  returning id into log_id;

  return log_id;
end;
$$;

create or replace function public.operator_create_invitation(
  email_input text,
  invited_person_name_input text,
  expires_at_input timestamptz,
  memberships_input jsonb
)
returns table (invitation_id uuid, invitation_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  operator_person_id uuid := public.current_person_id();
  new_invitation_id uuid;
  new_code text;
  membership_item jsonb;
  membership_team_id uuid;
  membership_role membership_role;
  invited_club uuid;
begin
  if not public.is_app_operator() then
    raise exception 'Operator access is required.';
  end if;

  if position('@' in coalesce(email_input, '')) <= 1 then
    raise exception 'A valid email is required.';
  end if;

  if trim(coalesce(invited_person_name_input, '')) = '' then
    raise exception 'Invited person name is required.';
  end if;

  if jsonb_typeof(memberships_input) <> 'array' or jsonb_array_length(memberships_input) = 0 then
    raise exception 'At least one team role is required.';
  end if;

  select t.club_id
  into invited_club
  from jsonb_array_elements(memberships_input) item
  join public.team t on t.id = (item ->> 'team_id')::uuid
  limit 1;

  loop
    new_code := upper(encode(gen_random_bytes(5), 'hex'));
    exit when not exists (select 1 from public.invitation where invitation_code = new_code);
  end loop;

  insert into public.invitation (
    email,
    invitation_code,
    invited_person_name,
    invited_club_id,
    invited_role,
    expires_at,
    created_by
  )
  values (
    lower(trim(email_input)),
    new_code,
    trim(invited_person_name_input),
    invited_club,
    coalesce((memberships_input -> 0 ->> 'role')::membership_role, 'Player'),
    coalesce(expires_at_input, now() + interval '30 days'),
    operator_person_id
  )
  returning id into new_invitation_id;

  for membership_item in select * from jsonb_array_elements(memberships_input)
  loop
    membership_team_id := (membership_item ->> 'team_id')::uuid;
    membership_role := (membership_item ->> 'role')::membership_role;

    if membership_role not in ('Player', 'Manager', 'Assistant Manager') then
      raise exception 'Invalid membership role.';
    end if;

    insert into public.invitation_membership (invitation_id, team_id, role)
    values (new_invitation_id, membership_team_id, membership_role)
    on conflict (invitation_id, team_id, role) do nothing;
  end loop;

  invitation_id := new_invitation_id;
  invitation_code := new_code;
  return next;
end;
$$;

create or replace function public.operator_set_team_membership(
  person_id_input uuid,
  team_id_input uuid,
  role_input membership_role,
  active_input boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  membership_id uuid;
begin
  if not public.is_app_operator() then
    raise exception 'Operator access is required.';
  end if;

  insert into public.team_membership (person_id, team_id, role, active)
  values (person_id_input, team_id_input, role_input, coalesce(active_input, true))
  on conflict (team_id, person_id, role) do update
  set active = excluded.active
  returning id into membership_id;

  return membership_id;
end;
$$;

create or replace function public.operator_update_invitation_request_status(
  request_id_input uuid,
  status_input invitation_request_status
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_operator() then
    raise exception 'Operator access is required.';
  end if;

  update public.invitation_request
  set status = status_input,
      reviewed_at = now(),
      reviewed_by = public.current_person_id()
  where id = request_id_input;

  return request_id_input;
end;
$$;

alter table public.person enable row level security;
alter table public.user_account enable row level security;
alter table public.app_session enable row level security;
alter table public.app_operator enable row level security;
alter table public.club enable row level security;
alter table public.club_table enable row level security;
alter table public.season enable row level security;
alter table public.league enable row level security;
alter table public.team enable row level security;
alter table public.team_membership enable row level security;
alter table public.club_membership enable row level security;
alter table public.invitation enable row level security;
alter table public.invitation_membership enable row level security;
alter table public.invitation_request enable row level security;
alter table public.fixture enable row level security;
alter table public.match enable row level security;
alter table public.game enable row level security;
alter table public.player_game_result enable row level security;
alter table public.match_lineup enable row level security;
alter table public.break enable row level security;
alter table public.user_activity_log enable row level security;
alter table public.table_booking enable row level security;
alter table public.conversation enable row level security;
alter table public.conversation_participant enable row level security;
alter table public.message enable row level security;

create or replace function public.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select person_id from public.user_account where id = auth.uid() and active = true
$$;

create or replace function public.is_app_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_operator ao
    where ao.person_id = public.current_person_id()
      and ao.active = true
  )
$$;

create or replace function public.is_manager_for_team(team_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_membership
    where team_id = team_uuid
      and person_id = public.current_person_id()
      and role in ('Manager', 'Assistant Manager')
      and active = true
  )
$$;

create policy "people can read active league people" on public.person for select to authenticated using (active = true);
create policy "operators can read all people" on public.person for select to authenticated using (public.is_app_operator());
create policy "users can read their account" on public.user_account for select to authenticated using (id = auth.uid());
create policy "operators can read user accounts" on public.user_account for select to authenticated using (public.is_app_operator());
create policy "no client session access" on public.app_session for all to authenticated using (false) with check (false);
create policy "operators can read operator markers" on public.app_operator for select to authenticated using (public.is_app_operator() or person_id = public.current_person_id());
create policy "authenticated users can read clubs" on public.club for select to authenticated using (active = true);
create policy "authenticated users can read club tables" on public.club_table for select to authenticated using (active = true);
create policy "authenticated users can read seasons" on public.season for select to authenticated using (true);
create policy "authenticated users can read leagues" on public.league for select to authenticated using (true);
create policy "authenticated users can read teams" on public.team for select to authenticated using (active = true);
create policy "members can read memberships" on public.team_membership for select to authenticated using (active = true);
create policy "operators can read all memberships" on public.team_membership for select to authenticated using (public.is_app_operator());
create policy "members can read club memberships" on public.club_membership for select to authenticated using (active = true);
create policy "operators can read all club memberships" on public.club_membership for select to authenticated using (public.is_app_operator());
create policy "operators can read invitations" on public.invitation for select to authenticated using (public.is_app_operator());
create policy "operators can read invitation memberships" on public.invitation_membership for select to authenticated using (public.is_app_operator());
create policy "operators can read invite requests" on public.invitation_request for select to authenticated using (public.is_app_operator());
create policy "members can read fixtures" on public.fixture for select to authenticated using (true);
create policy "members can read matches" on public.match for select to authenticated using (true);
create policy "members can read games" on public.game for select to authenticated using (true);
create policy "members can read player game results" on public.player_game_result for select to authenticated using (true);
create policy "members can read breaks" on public.break for select to authenticated using (true);
create policy "users can read their own activity" on public.user_activity_log for select to authenticated using (auth_user_id = auth.uid());
create policy "operators can read activity" on public.user_activity_log for select to authenticated using (public.is_app_operator());
create policy "members can read table bookings" on public.table_booking for select to authenticated using (cancelled_at is null);

create policy "managers can create fixtures" on public.fixture for insert to authenticated
with check (public.is_manager_for_team(home_team_id) or public.is_manager_for_team(away_team_id));

create policy "managers can enter matches" on public.match for insert to authenticated
with check (
  exists (
    select 1 from public.fixture f
    where f.id = fixture_id
      and (public.is_manager_for_team(f.home_team_id) or public.is_manager_for_team(f.away_team_id))
  )
);

create policy "managers can manage lineups" on public.match_lineup for all to authenticated
using (public.is_manager_for_team(team_id))
with check (public.is_manager_for_team(team_id));

create policy "managers can record breaks" on public.break for insert to authenticated
with check (
  exists (
    select 1
    from public.game g
    join public.match m on m.id = g.match_id
    join public.fixture f on f.id = m.fixture_id
    where g.id = game_id
      and (public.is_manager_for_team(f.home_team_id) or public.is_manager_for_team(f.away_team_id))
  )
);

create policy "participants can read conversations" on public.conversation for select to authenticated
using (
  exists (
    select 1 from public.conversation_participant cp
    where cp.conversation_id = id and cp.person_id = public.current_person_id()
  )
);

create policy "participants can read participant rows" on public.conversation_participant for select to authenticated
using (person_id = public.current_person_id());

create policy "participants can read messages" on public.message for select to authenticated
using (
  exists (
    select 1 from public.conversation_participant cp
    where cp.conversation_id = message.conversation_id and cp.person_id = public.current_person_id()
  )
);

insert into public.league (name, playing_day)
values
  ('A League', 'Thursday'),
  ('B League', 'Thursday'),
  ('C League', 'Monday')
on conflict (name) do update set playing_day = excluded.playing_day;
