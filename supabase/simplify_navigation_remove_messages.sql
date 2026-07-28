-- Simplify app navigation and remove messages from role home screens.
-- Club features are reached through a contained Club page for team roles.

insert into public.appearance (role_type, panel_config, menu_config, active)
values
  (
    'Player',
    '["matchPlanning","teamStats","myStats","teamRecentForm","personalRecentForm","individualGames"]'::jsonb,
    '["Home","Fixtures","Table","Club"]'::jsonb,
    true
  ),
  (
    'Manager',
    '["matchPlanning","managerActions","seasonComplete","teamRecentForm","squadManagement","managerSnapshot"]'::jsonb,
    '["Home","Fixtures","Table","Club","Results"]'::jsonb,
    true
  ),
  (
    'Assistant Manager',
    '["assistantHub","seasonComplete","managerSnapshot"]'::jsonb,
    '["Home","Fixtures","Table","Club","Results"]'::jsonb,
    true
  ),
  (
    'Club Member',
    '["openCompetitions"]'::jsonb,
    '["Home","Bookings","Competitions"]'::jsonb,
    true
  ),
  (
    'Club Admin',
    '["clubCompetitionAdmin","openCompetitions","interclubLeagues"]'::jsonb,
    '["Home","Competitions","Bookings","Interclub Leagues"]'::jsonb,
    true
  )
on conflict (role_type) do update
set panel_config = excluded.panel_config,
    menu_config = excluded.menu_config,
    active = true,
    updated_at = now();
