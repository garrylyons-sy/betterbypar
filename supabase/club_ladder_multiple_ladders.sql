-- Allow each club to run multiple ladders with optional team eligibility
-- and an independent handicap mode.

alter table public.club_ladder
  drop constraint if exists club_ladder_club_id_key;

alter table public.club_ladder
  add column if not exists use_handicap boolean not null default true;

create unique index if not exists club_ladder_club_name_unique_idx
  on public.club_ladder(club_id, lower(name));

create table if not exists public.club_ladder_eligible_team (
  ladder_id uuid not null references public.club_ladder(id) on delete cascade,
  team_id uuid not null references public.team(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (ladder_id, team_id)
);

alter table public.club_ladder_eligible_team
  drop constraint if exists club_ladder_eligible_team_team_id_fkey;
alter table public.club_ladder_eligible_team
  add constraint club_ladder_eligible_team_team_id_fkey
  foreign key (team_id) references public.team(id) on delete restrict;

create or replace function public.club_ladder_eligible_team_same_club()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.club_ladder ladder
    join public.team team on team.id = new.team_id
    where ladder.id = new.ladder_id and ladder.club_id = team.club_id
  ) then
    raise exception 'Eligible teams must belong to the ladder club.';
  end if;
  return new;
end;
$$;

drop trigger if exists club_ladder_eligible_team_same_club on public.club_ladder_eligible_team;
create trigger club_ladder_eligible_team_same_club
before insert or update on public.club_ladder_eligible_team
for each row execute function public.club_ladder_eligible_team_same_club();

alter table public.club_ladder_eligible_team enable row level security;

drop policy if exists "authenticated users can read club ladder eligible teams"
  on public.club_ladder_eligible_team;
create policy "authenticated users can read club ladder eligible teams"
  on public.club_ladder_eligible_team for select to authenticated using (true);

comment on table public.club_ladder_eligible_team is
  'Optional team restrictions for a club ladder. No rows means all active club members are eligible.';
