alter table public.club
  add column if not exists allow_unlimited_lower_team_players boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team'
      and column_name = 'allow_unlimited_lower_team_players'
  ) then
    execute $migration$
      update public.club c
      set allow_unlimited_lower_team_players = true
      where exists (
        select 1
        from public.team t
        where t.club_id = c.id
          and t.allow_unlimited_lower_team_players = true
      )
    $migration$;
  end if;
end $$;

alter table public.team
  drop column if exists allow_unlimited_lower_team_players;

comment on column public.club.allow_unlimited_lower_team_players is
  'When enabled, lower-team players may represent higher teams in this club more than once during the season.';
