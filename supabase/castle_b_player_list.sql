-- Castle B player list.
-- Adds selectable Castle B players without creating invitations or login accounts.

with wanted_players(first_name, last_name, email) as (
  values
    ('Brendan', 'Flynn', 'brendan.flynn@notrealmail.com'),
    ('Brendan', 'Walsh', 'brendan.walsh@notrealmail.com'),
    ('Brian', 'Gaw', 'brian.gaw@notrealmail.com'),
    ('Colin', 'Brennan', 'colin.brennan@notrealmail.com'),
    ('Diarmuid', 'McAuliffe', 'diarmuid.mcauliffe@notrealmail.com'),
    ('Joe', 'Connor', 'joe.connor@notrealmail.com'),
    ('Ken', 'Martin', 'ken.martin@notrealmail.com'),
    ('Ken', 'McCoy', 'ken.mccoy@notrealmail.com'),
    ('Nick', 'McAuliffe', 'nick.mcauliffe@notrealmail.com')
),
castle_b as (
  select
    c.id as club_id,
    l.id as league_id
  from public.club c
  cross join public.league l
  where c.name = 'Castle Golf Club'
    and l.name = 'B League'
),
inserted_people as (
  insert into public.person (first_name, last_name, email, active)
  select first_name, last_name, email, true
  from wanted_players
  on conflict (email) do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      active = true
  returning id, first_name, last_name, email
),
memberships as (
  insert into public.club_membership (club_id, person_id, role, joined_date, active)
  select castle_b.club_id, inserted_people.id, 'Club Member', current_date, true
  from inserted_people
  cross join castle_b
  on conflict (club_id, person_id, role) do update
  set active = true,
      joined_date = least(public.club_membership.joined_date, excluded.joined_date)
  returning id, person_id, club_id
),
roles as (
  insert into public.person_team_role (club_membership_id, person_id, club_id, league_id, team_name, role, joined_date, active)
  select memberships.id, memberships.person_id, castle_b.club_id, castle_b.league_id, 'Castle B', 'Player', current_date, true
  from memberships
  cross join castle_b
  on conflict (person_id, club_id, league_id, team_name, role) do update
  set club_membership_id = excluded.club_membership_id,
      active = true,
      joined_date = least(public.person_team_role.joined_date, excluded.joined_date)
  returning person_id
),
deactivated_roles as (
  update public.person_team_role ptr
  set active = false
  from castle_b
  where ptr.club_id = castle_b.club_id
    and ptr.league_id = castle_b.league_id
    and ptr.team_name = 'Castle B'
    and ptr.role = 'Player'
    and ptr.person_id not in (select id from inserted_people)
  returning ptr.person_id
),
deactivated_legacy_memberships as (
  update public.team_membership tm
  set active = false
  from public.team t
  join castle_b on castle_b.club_id = t.club_id and castle_b.league_id = t.league_id
  where tm.team_id = t.id
    and t.name = 'Castle B'
    and tm.role = 'Player'
    and tm.person_id not in (select id from inserted_people)
  returning tm.person_id
)
insert into public.team_membership (team_id, person_id, role, joined_date, active)
select t.id, inserted_people.id, 'Player', current_date, true
from inserted_people
cross join castle_b
join public.team t
  on t.club_id = castle_b.club_id
 and t.league_id = castle_b.league_id
 and t.name = 'Castle B'
 and t.active = true
on conflict (team_id, person_id, role) do update
set active = true,
    joined_date = least(public.team_membership.joined_date, excluded.joined_date);
