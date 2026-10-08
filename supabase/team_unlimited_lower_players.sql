alter table public.team
  add column if not exists allow_unlimited_lower_team_players boolean not null default false;

comment on column public.team.allow_unlimited_lower_team_players is
  'When enabled, lower-team players may represent this team more than once during the season.';
