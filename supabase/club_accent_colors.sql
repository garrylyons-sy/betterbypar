alter table public.club
add column if not exists accent_color text check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$');

with club_colours (name, primary_color, accent_color) as (
  values
    ('Castle Golf Club', '#030E66', '#10233F'),
    ('Grange Golf Club', '#006B3F', '#003D2B'),
    ('Milltown Golf Club', '#8B1218', '#12345A'),
    ('Elm Park Golf Club', '#B43C2B', '#4A1114'),
    ('Stackstown Golf Club', '#1D7A43', '#0E3D25'),
    ('Woodbrook Golf Club', '#193C64', '#0B243B'),
    ('Newlands Golf Club', '#008E3A', '#005C2E'),
    ('Dun Laoghaire Golf Club', '#0E4D73', '#07233A'),
    ('Fitzwilliam Lawn Tennis Club', '#164236', '#B5963B')
)
update public.club c
set primary_color = cc.primary_color,
    accent_color = cc.accent_color
from club_colours cc
where c.name = cc.name;

create or replace view public.user_team_context_view
with (security_invoker = true) as
select
  ua.id as auth_user_id,
  p.id as person_id,
  p.first_name,
  p.last_name,
  ua.username,
  tm.id as membership_id,
  tm.role,
  t.id as team_id,
  t.name as team_name,
  c.id as club_id,
  c.name as club_name,
  c.logo_path,
  c.primary_color,
  l.id as league_id,
  l.name as league_name,
  s.id as season_id,
  s.name as season_name,
  c.accent_color
from public.user_account ua
join public.person p on p.id = ua.person_id
join public.team_membership tm on tm.person_id = p.id and tm.active = true
join public.team t on t.id = tm.team_id and t.active = true
join public.club c on c.id = t.club_id and c.active = true
join public.league l on l.id = t.league_id
join public.season s on s.id = t.season_id
where ua.active = true;
