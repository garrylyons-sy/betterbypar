-- 2026/27 has not started yet. Keep the season shell, but remove seeded
-- competition data so the app does not display future teams, standings, or memberships.

do $$
declare
  season_uuid uuid;
begin
  select id into season_uuid
  from public.season
  where name = '2026/27';

  if season_uuid is null then
    insert into public.season (name, starts_on, ends_on, active)
    values ('2026/27', '2026-09-01', '2027-03-31', false);
    return;
  end if;

  delete from public.break
  where game_id in (
    select g.id
    from public.game g
    join public.match m on m.id = g.match_id
    join public.fixture f on f.id = m.fixture_id
    where f.season_id = season_uuid
  );

  delete from public.match_lineup
  where match_id in (
    select m.id
    from public.match m
    join public.fixture f on f.id = m.fixture_id
    where f.season_id = season_uuid
  );

  delete from public.game
  where match_id in (
    select m.id
    from public.match m
    join public.fixture f on f.id = m.fixture_id
    where f.season_id = season_uuid
  );

  delete from public.match
  where fixture_id in (
    select id
    from public.fixture
    where season_id = season_uuid
  );

  delete from public.fixture
  where season_id = season_uuid;

  delete from public.player_game_result
  where season_id = season_uuid;

  delete from public.invitation_membership
  where team_id in (
    select id
    from public.team
    where season_id = season_uuid
  );

  delete from public.team_membership
  where team_id in (
    select id
    from public.team
    where season_id = season_uuid
  );

  delete from public.invitation
  where invitation_code in (
    'GARLYONS-CASTLE-A-2026',
    'CASTLE-A-PLAYER-2026',
    'CASTLE-A-PLAYER-B-MANAGER-2026'
  );

  delete from public.team
  where season_id = season_uuid;

  update public.season
  set starts_on = '2026-09-01',
      ends_on = '2027-03-31',
      active = false
  where id = season_uuid;
end $$;
