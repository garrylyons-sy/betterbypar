insert into public.season (name, starts_on, ends_on, active)
values ('2026/27', '2026-09-01', '2027-03-31', false)
on conflict (name) do update
set starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    active = excluded.active;

insert into public.league (name, playing_day)
values
  ('A League', 'Thursday'),
  ('B League', 'Thursday'),
  ('C League', 'Monday')
on conflict (name) do update set playing_day = excluded.playing_day;

insert into public.club (name, venue, logo_path, primary_color, accent_color, active)
values
  ('Castle Golf Club', 'Castle Golf Club', '/club-logos/castle.png', '#030E66', '#10233F', true),
  ('Grange Golf Club', 'Grange Golf Club', '/club-logos/grange.png', '#006B3F', '#003D2B', true),
  ('Milltown Golf Club', 'Milltown Golf Club', '/club-logos/milltown.png', '#1B5E3A', '#0F2F24', true),
  ('Elm Park Golf Club', 'Elm Park Golf Club', '/club-logos/elm-park.png', '#B43C2B', '#4A1114', true),
  ('Stackstown Golf Club', 'Stackstown Golf Club', '/club-logos/stackstown.png', '#1D7A43', '#0E3D25', true),
  ('Woodbrook Golf Club', 'Woodbrook Golf Club', '/club-logos/woodbrook.jpg', '#193C64', '#0B243B', true),
  ('Newlands Golf Club', 'Newlands Golf Club', '/club-logos/newlands.png', '#008E3A', '#005C2E', true),
  ('Dun Laoghaire Golf Club', 'Dun Laoghaire Golf Club', '/club-logos/dun-laoghaire.svg', '#0E4D73', '#07233A', true),
  ('Fitzwilliam Lawn Tennis Club', 'Fitzwilliam Lawn Tennis Club', '/club-logos/fitzwilliam.png', '#164236', '#B5963B', true)
on conflict (name) do update
set venue = excluded.venue,
    logo_path = excluded.logo_path,
    primary_color = excluded.primary_color,
    accent_color = excluded.accent_color,
    active = excluded.active;

insert into public.club_table (club_id, table_name, table_description, active)
select c.id, table_name, table_description, true
from public.club c
cross join (
  values
    ('Table 1', 'Beside window'),
    ('Table 2', 'Near door')
) as castle_tables(table_name, table_description)
where c.name = 'Castle Golf Club'
on conflict (club_id, table_name) do update
set table_description = excluded.table_description,
    active = excluded.active;

insert into public.club_membership (club_id, person_id, role, active)
select c.id, p.id, 'Club Member', true
from public.club c
join public.person p on lower(p.email) = lower('garlyons@gmail.com')
where c.name = 'Castle Golf Club'
on conflict (club_id, person_id, role) do update
set active = excluded.active;

insert into public.app_operator (person_id, active)
select p.id, true
from public.person p
where lower(p.email) = lower('garlyons@gmail.com')
on conflict (person_id) do update
set active = excluded.active;
