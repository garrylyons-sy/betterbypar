-- Put player stats, player league table and fixtures on player home.
-- Put all team player stats near the top of manager home.

update public.appearance
set panel_config = '["matchPlanning","myStats","leagueTableSnapshot","teamStats","teamRecentForm","personalRecentForm","individualGames"]'::jsonb,
    menu_config = '["Home","Fixtures","Table","Club"]'::jsonb,
    updated_at = now()
where role_type = 'Player';

update public.appearance
set panel_config = '["matchPlanning","squadManagement","managerActions","seasonComplete","teamRecentForm","managerSnapshot"]'::jsonb,
    menu_config = '["Home","Fixtures","Table","Club","Results"]'::jsonb,
    updated_at = now()
where role_type = 'Manager';
