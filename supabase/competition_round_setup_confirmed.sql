alter table public.competition
add column if not exists round_settings_confirmed boolean not null default false;

update public.competition c
set round_settings_confirmed = true
where exists (
  select 1
  from public.competition_round cr
  where cr.competition_id = c.id
    and cr.frames_to_play <> 1
);
