create extension if not exists pgcrypto;

create type invitation_status as enum ('Pending', 'Accepted', 'Expired', 'Revoked');
create type membership_role as enum ('Player', 'Manager', 'Assistant Manager');
create type fixture_status as enum ('Scheduled', 'Completed', 'Cancelled');
create type game_type as enum ('Singles', 'Doubles');

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
  id uuid primary key references auth.users(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete cascade,
  username text unique not null,
  google_id text unique,
  last_login timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.club (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  venue text,
  address text,
  logo_path text,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true
);

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
      coalesce(sum(case when mp.home_team_points > mp.away_team_points and mp.home_team_id = t.id then 1 when mp.away_team_points > mp.home_team_points and mp.away_team_id = t.id then 1 else 0 end), 0) desc,
      coalesce(sum(case when mp.home_team_id = t.id then mp.home_team_points when mp.away_team_id = t.id then mp.away_team_points else 0 end), 0) desc
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

alter table public.person enable row level security;
alter table public.user_account enable row level security;
alter table public.club enable row level security;
alter table public.season enable row level security;
alter table public.league enable row level security;
alter table public.team enable row level security;
alter table public.team_membership enable row level security;
alter table public.invitation enable row level security;
alter table public.fixture enable row level security;
alter table public.match enable row level security;
alter table public.game enable row level security;
alter table public.match_lineup enable row level security;
alter table public.break enable row level security;
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
create policy "users can read their account" on public.user_account for select to authenticated using (id = auth.uid());
create policy "authenticated users can read clubs" on public.club for select to authenticated using (active = true);
create policy "authenticated users can read seasons" on public.season for select to authenticated using (true);
create policy "authenticated users can read leagues" on public.league for select to authenticated using (true);
create policy "authenticated users can read teams" on public.team for select to authenticated using (active = true);
create policy "members can read memberships" on public.team_membership for select to authenticated using (active = true);
create policy "members can read fixtures" on public.fixture for select to authenticated using (true);
create policy "members can read matches" on public.match for select to authenticated using (true);
create policy "members can read games" on public.game for select to authenticated using (true);
create policy "members can read breaks" on public.break for select to authenticated using (true);

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
