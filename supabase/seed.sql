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

insert into public.club (name, venue, logo_path, primary_color, active)
values
  ('Castle Golf Club', 'Castle Golf Club', '/club-logos/castle.png', '#030E66', true),
  ('Grange Golf Club', 'Grange Golf Club', '/club-logos/grange.png', '#006B3F', true),
  ('Milltown Golf Club', 'Milltown Golf Club', '/club-logos/milltown.png', '#1B5E3A', true),
  ('Elm Park Golf Club', 'Elm Park Golf Club', '/club-logos/elm-park.png', '#B43C2B', true),
  ('Stackstown Golf Club', 'Stackstown Golf Club', '/club-logos/stackstown.png', '#1D7A43', true),
  ('Woodbrook Golf Club', 'Woodbrook Golf Club', '/club-logos/woodbrook.jpg', '#193C64', true),
  ('Newlands Golf Club', 'Newlands Golf Club', '/club-logos/newlands.png', '#008E3A', true),
  ('Dun Laoghaire Golf Club', 'Dun Laoghaire Golf Club', '/club-logos/dun-laoghaire.png', '#7A4A24', true),
  ('Fitzwilliam Lawn Tennis Club', 'Fitzwilliam Lawn Tennis Club', '/club-logos/fitzwilliam.png', '#6F4A1F', true)
on conflict (name) do update
set venue = excluded.venue,
    logo_path = excluded.logo_path,
    primary_color = excluded.primary_color,
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

with source_invitations (email, invitation_code, invited_person_name, invited_club_name, invited_role) as (
  values
    ('garlyons@gmail.com', 'GARLYONS-CASTLE-A-2026', 'Garry Lyons', 'Castle Golf Club', 'Player'::membership_role),
    ('castle.player@example.com', 'CASTLE-A-PLAYER-2026', 'Castle Player', 'Castle Golf Club', 'Player'::membership_role),
    ('castle.dual@example.com', 'CASTLE-A-PLAYER-B-MANAGER-2026', 'Castle Dual Role', 'Castle Golf Club', 'Player'::membership_role)
)
insert into public.invitation (email, invitation_code, invited_person_name, invited_club_id, invited_role, expires_at, status)
select si.email, si.invitation_code, si.invited_person_name, c.id, si.invited_role, '2027-05-31 23:59:59+00'::timestamptz, 'Pending'
from source_invitations si
join public.club c on c.name = si.invited_club_name
on conflict (invitation_code) do update
set email = excluded.email,
    invited_person_name = excluded.invited_person_name,
    invited_club_id = excluded.invited_club_id,
    invited_role = excluded.invited_role,
    expires_at = excluded.expires_at,
    status = case when public.invitation.status = 'Accepted' then public.invitation.status else excluded.status end;

with source_memberships (invitation_code, team_name, league_name, role) as (
  values
    ('GARLYONS-CASTLE-A-2026', 'Castle A', 'A League', 'Player'::membership_role),
    ('CASTLE-A-PLAYER-2026', 'Castle A', 'A League', 'Player'::membership_role),
    ('CASTLE-A-PLAYER-B-MANAGER-2026', 'Castle A', 'A League', 'Player'::membership_role),
    ('CASTLE-A-PLAYER-B-MANAGER-2026', 'Castle B', 'B League', 'Manager'::membership_role)
)
insert into public.invitation_membership (invitation_id, team_id, role)
select i.id, t.id, sm.role
from source_memberships sm
join public.invitation i on i.invitation_code = sm.invitation_code
join public.season s on s.name = '2026/27'
join public.league l on l.name = sm.league_name
join public.team t on t.name = sm.team_name and t.league_id = l.id and t.season_id = s.id
on conflict (invitation_id, team_id, role) do nothing;
