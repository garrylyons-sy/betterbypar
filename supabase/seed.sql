insert into public.season (name, starts_on, ends_on, active)
values ('2026/27', '2026-09-01', '2027-05-31', true)
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

insert into public.club (name, venue, active)
values
  ('Castle Golf Club', 'Castle Golf Club', true),
  ('Grange Golf Club', 'Grange Golf Club', true),
  ('Milltown Golf Club', 'Milltown Golf Club', true),
  ('Elm Park Golf Club', 'Elm Park Golf Club', true),
  ('Stackstown Golf Club', 'Stackstown Golf Club', true),
  ('Woodbrook Golf Club', 'Woodbrook Golf Club', true),
  ('Newlands Golf Club', 'Newlands Golf Club', true),
  ('Dun Laoghaire Golf Club', 'Dun Laoghaire Golf Club', true),
  ('Fitzwilliam Lawn Tennis Club', 'Fitzwilliam Lawn Tennis Club', true)
on conflict (name) do update
set venue = excluded.venue,
    active = excluded.active;

with requested_teams (club_name, team_suffix, league_name) as (
  values
    ('Castle Golf Club', 'A', 'A League'),
    ('Castle Golf Club', 'B', 'B League'),
    ('Castle Golf Club', 'C', 'C League'),
    ('Grange Golf Club', 'A', 'A League'),
    ('Grange Golf Club', 'B', 'B League'),
    ('Grange Golf Club', 'C', 'C League'),
    ('Milltown Golf Club', 'A', 'A League'),
    ('Milltown Golf Club', 'B', 'B League'),
    ('Elm Park Golf Club', 'A', 'A League'),
    ('Elm Park Golf Club', 'B', 'B League'),
    ('Elm Park Golf Club', 'C', 'C League'),
    ('Stackstown Golf Club', 'A', 'A League'),
    ('Stackstown Golf Club', 'B', 'B League'),
    ('Stackstown Golf Club', 'C', 'C League'),
    ('Woodbrook Golf Club', 'A', 'A League'),
    ('Newlands Golf Club', 'A', 'A League'),
    ('Newlands Golf Club', 'B', 'B League'),
    ('Newlands Golf Club', 'C', 'C League'),
    ('Dun Laoghaire Golf Club', 'A', 'A League'),
    ('Fitzwilliam Lawn Tennis Club', 'A', 'A League'),
    ('Fitzwilliam Lawn Tennis Club', 'B', 'B League')
),
team_rows as (
  select
    c.id as club_id,
    l.id as league_id,
    s.id as season_id,
    case
      when c.name = 'Dun Laoghaire Golf Club' then 'Dun Laoghaire'
      when c.name = 'Fitzwilliam Lawn Tennis Club' then 'Fitzwilliam'
      else regexp_replace(c.name, ' Golf Club$', '')
    end || ' ' || rt.team_suffix as team_name
  from requested_teams rt
  join public.club c on c.name = rt.club_name
  join public.league l on l.name = rt.league_name
  join public.season s on s.name = '2026/27'
)
insert into public.team (club_id, league_id, season_id, name, active)
select club_id, league_id, season_id, team_name, true
from team_rows
on conflict (league_id, season_id, name) do update
set club_id = excluded.club_id,
    active = excluded.active;
