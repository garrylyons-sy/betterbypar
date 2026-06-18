update public.appearance
set panel_config = '["openCompetitions","messages"]'::jsonb,
    menu_config = '["Home","Bookings","Competitions","Messages"]'::jsonb,
    active = true,
    updated_at = now()
where role_type = 'Club Member';

update public.appearance
set panel_config = '["clubCompetitionAdmin","openCompetitions","interclubLeagues","messages"]'::jsonb,
    menu_config = '["Home","Bookings","Competitions","Messages","Interclub Leagues"]'::jsonb,
    active = true,
    updated_at = now()
where role_type = 'Club Admin';
