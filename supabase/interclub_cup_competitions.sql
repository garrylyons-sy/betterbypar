-- Interclub knockout cups reuse ordinary fixtures for resolved ties while
-- retaining later-round placeholders in a separate bracket model.

alter table public.fixture drop constraint if exists fixture_fixture_type_check;
alter table public.fixture
  add constraint fixture_fixture_type_check
  check (fixture_type in ('League', 'Friendly', 'Cup'));

alter table public.match drop constraint if exists match_home_team_score_check;
alter table public.match drop constraint if exists match_away_team_score_check;
alter table public.match drop constraint if exists match_check;
alter table public.match drop constraint if exists match_total_score_check;
alter table public.match
  add constraint match_home_team_score_check check (home_team_score between 0 and 99),
  add constraint match_away_team_score_check check (away_team_score between 0 and 99),
  add constraint match_total_score_check check (home_team_score + away_team_score <= 99);

alter table public.game drop constraint if exists game_game_number_check;
alter table public.game drop constraint if exists game_live_order_check;
alter table public.game drop constraint if exists game_format_check;
alter table public.game
  add constraint game_game_number_check check (game_number between 1 and 15),
  add constraint game_format_check check (
    (game_type = 'Singles' and home_player_2_id is null and away_player_2_id is null)
    or game_type = 'Doubles'
  );

alter table public.fixture_lineup_slot drop constraint if exists fixture_lineup_slot_slot_number_check;
alter table public.fixture_lineup_slot drop constraint if exists fixture_lineup_slot_game_type_check;
alter table public.fixture_lineup_slot
  add constraint fixture_lineup_slot_slot_number_check check (slot_number between 1 and 15);

create table if not exists public.cup_competition (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.season(id) on delete restrict,
  name text not null,
  round_count integer not null check (round_count between 1 and 6),
  status text not null default 'Draft' check (status in ('Draft', 'Drawn', 'In Progress', 'Complete')),
  created_by uuid references public.person(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, name)
);

alter table public.cup_competition
  add column if not exists audience text not null default 'All Players';
alter table public.cup_competition drop constraint if exists cup_competition_audience_check;
alter table public.cup_competition
  add constraint cup_competition_audience_check
  check (audience in ('Everyone', 'All Players', 'All Managers', 'All Players and Managers', 'Specific Leagues', 'League Chairs'));

create table if not exists public.cup_competition_format_slot (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.cup_competition(id) on delete cascade,
  slot_number integer not null check (slot_number between 1 and 15),
  game_type public.game_type not null,
  points_awarded integer not null default 1 check (points_awarded = 1),
  unique (competition_id, slot_number)
);

create table if not exists public.cup_competition_entry (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.cup_competition(id) on delete cascade,
  team_id uuid not null references public.team(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (competition_id, team_id)
);

create table if not exists public.cup_competition_visibility_league (
  competition_id uuid not null references public.cup_competition(id) on delete cascade,
  league_id uuid not null references public.league(id) on delete cascade,
  primary key (competition_id, league_id)
);

create table if not exists public.cup_competition_round (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.cup_competition(id) on delete cascade,
  round_number integer not null check (round_number between 1 and 6),
  name text not null,
  fixture_date date not null,
  unique (competition_id, round_number)
);

create table if not exists public.cup_competition_tie (
  id uuid primary key default gen_random_uuid(),
  competition_round_id uuid not null references public.cup_competition_round(id) on delete cascade,
  match_number integer not null check (match_number > 0),
  home_team_id uuid references public.team(id) on delete restrict,
  away_team_id uuid references public.team(id) on delete restrict,
  home_source_tie_id uuid references public.cup_competition_tie(id) on delete set null,
  away_source_tie_id uuid references public.cup_competition_tie(id) on delete set null,
  fixture_id uuid unique references public.fixture(id) on delete set null,
  winner_team_id uuid references public.team(id) on delete restrict,
  status text not null default 'Awaiting Teams' check (status in ('Awaiting Teams', 'Scheduled', 'Bye', 'Completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_round_id, match_number),
  check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id)
);

create index if not exists cup_competition_season_idx on public.cup_competition(season_id, status);
create index if not exists cup_competition_entry_team_idx on public.cup_competition_entry(team_id, competition_id);
create index if not exists cup_competition_visibility_league_idx on public.cup_competition_visibility_league(league_id, competition_id);
create index if not exists cup_competition_tie_fixture_idx on public.cup_competition_tie(fixture_id) where fixture_id is not null;

create or replace function public.delete_cup_competition_fixtures()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.fixture
  where id in (
    select ct.fixture_id
    from public.cup_competition_tie ct
    join public.cup_competition_round cr on cr.id = ct.competition_round_id
    where cr.competition_id = old.id
      and ct.fixture_id is not null
  );
  return old;
end;
$$;

drop trigger if exists delete_cup_competition_fixtures_before_delete on public.cup_competition;
create trigger delete_cup_competition_fixtures_before_delete
before delete on public.cup_competition
for each row execute function public.delete_cup_competition_fixtures();

alter table public.cup_competition enable row level security;
alter table public.cup_competition_format_slot enable row level security;
alter table public.cup_competition_entry enable row level security;
alter table public.cup_competition_visibility_league enable row level security;
alter table public.cup_competition_round enable row level security;
alter table public.cup_competition_tie enable row level security;

drop policy if exists "authenticated users can read cup competitions" on public.cup_competition;
create policy "authenticated users can read cup competitions" on public.cup_competition for select to authenticated using (true);
drop policy if exists "authenticated users can read cup formats" on public.cup_competition_format_slot;
create policy "authenticated users can read cup formats" on public.cup_competition_format_slot for select to authenticated using (true);
drop policy if exists "authenticated users can read cup entries" on public.cup_competition_entry;
create policy "authenticated users can read cup entries" on public.cup_competition_entry for select to authenticated using (true);
drop policy if exists "authenticated users can read cup visibility leagues" on public.cup_competition_visibility_league;
create policy "authenticated users can read cup visibility leagues" on public.cup_competition_visibility_league for select to authenticated using (true);
drop policy if exists "authenticated users can read cup rounds" on public.cup_competition_round;
create policy "authenticated users can read cup rounds" on public.cup_competition_round for select to authenticated using (true);
drop policy if exists "authenticated users can read cup ties" on public.cup_competition_tie;
create policy "authenticated users can read cup ties" on public.cup_competition_tie for select to authenticated using (true);

create or replace function public.can_person_view_cup(competition_uuid uuid, person_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.cup_competition cc
    where cc.id = competition_uuid
      and (
        exists (
          select 1 from public.app_operator ao
          where ao.person_id = person_uuid and ao.active = true
        )
        or (
          cc.audience = 'Everyone'
          and exists (
            select 1 from public.person p
            where p.id = person_uuid and p.active = true
          )
        )
        or (
          cc.audience = 'League Chairs'
          and exists (
            select 1 from public.club_membership cm
            where cm.person_id = person_uuid and cm.role = 'League Chair' and cm.active = true
          )
        )
        or (
          cc.audience = 'All Players'
          and (
            exists (
              select 1
              from public.person_team_role ptr
              join public.club_membership cm on cm.id = ptr.club_membership_id and cm.active = true
              where ptr.person_id = person_uuid and ptr.role = 'Player' and ptr.active = true
            )
            or exists (
              select 1 from public.team_membership tm
              where tm.person_id = person_uuid and tm.role = 'Player' and tm.active = true
            )
          )
        )
        or (
          cc.audience = 'All Managers'
          and (
            exists (
              select 1
              from public.person_team_role ptr
              join public.club_membership cm on cm.id = ptr.club_membership_id and cm.active = true
              where ptr.person_id = person_uuid and ptr.role = 'Manager' and ptr.active = true
            )
            or exists (
              select 1 from public.team_membership tm
              where tm.person_id = person_uuid and tm.role = 'Manager' and tm.active = true
            )
          )
        )
        or (
          cc.audience = 'All Players and Managers'
          and (
            exists (
              select 1
              from public.person_team_role ptr
              join public.club_membership cm on cm.id = ptr.club_membership_id and cm.active = true
              where ptr.person_id = person_uuid and ptr.role in ('Player', 'Manager') and ptr.active = true
            )
            or exists (
              select 1 from public.team_membership tm
              where tm.person_id = person_uuid and tm.role in ('Player', 'Manager') and tm.active = true
            )
          )
        )
        or (
          cc.audience = 'Specific Leagues'
          and exists (
            select 1
            from public.cup_competition_visibility_league cvl
            where cvl.competition_id = cc.id
              and (
                exists (
                  select 1
                  from public.person_team_role ptr
                  join public.club_membership cm on cm.id = ptr.club_membership_id and cm.active = true
                  where ptr.person_id = person_uuid
                    and ptr.league_id = cvl.league_id
                    and ptr.role in ('Player', 'Manager')
                    and ptr.active = true
                )
                or exists (
                  select 1
                  from public.team_membership tm
                  join public.team t on t.id = tm.team_id
                  where tm.person_id = person_uuid
                    and t.league_id = cvl.league_id
                    and tm.role in ('Player', 'Manager')
                    and tm.active = true
                )
              )
          )
        )
      )
  );
$$;

revoke all on function public.can_person_view_cup(uuid, uuid) from public;
grant execute on function public.can_person_view_cup(uuid, uuid) to authenticated;

comment on table public.cup_competition is 'Platform-managed interclub knockout cup.';
comment on table public.cup_competition_tie is 'Cup bracket tie. A fixture is created only after both teams are known.';
comment on column public.cup_competition.audience is 'Role or league audience allowed to discover this cup in the normal app.';
comment on column public.fixture.fixture_type is 'League fixtures affect tables and stats. Friendly and Cup fixtures reuse scoring but are excluded from league calculations.';
comment on table public.fixture_lineup_slot is 'Ordered lineup slots. League formats use their fixed patterns; cup formats may contain up to 15 configured singles or doubles matches.';
