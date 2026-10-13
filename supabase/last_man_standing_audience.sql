alter table public.last_man_standing_competition
  add column if not exists audience_team_id uuid references public.team(id) on delete restrict;

alter table public.last_man_standing_competition
  drop constraint if exists last_man_standing_competition_audience_check;

alter table public.last_man_standing_competition
  add constraint last_man_standing_competition_audience_check
  check (audience in ('League Chair', 'Team', 'Everyone'));

alter table public.last_man_standing_competition
  drop constraint if exists last_man_standing_competition_audience_team_check;

alter table public.last_man_standing_competition
  add constraint last_man_standing_competition_audience_team_check
  check ((audience = 'Team' and audience_team_id is not null) or (audience <> 'Team' and audience_team_id is null));

create index if not exists last_man_standing_competition_audience_team_idx
  on public.last_man_standing_competition (audience_team_id)
  where audience_team_id is not null;
