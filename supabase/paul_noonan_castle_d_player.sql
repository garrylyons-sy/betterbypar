with target_team as (
  select t.id as team_id, t.club_id, t.league_id, t.name as team_name
  from public.team t
  join public.season s on s.id = t.season_id
  where t.name = 'Castle D'
    and t.active = true
  order by s.starts_on desc nulls last, s.name desc
  limit 1
),
target_person as (
  insert into public.person (first_name, last_name, active)
  values ('Paul', 'Noonan', true)
  on conflict do nothing
  returning id
),
resolved_person as (
  select id
  from target_person
  union all
  select p.id
  from public.person p
  where lower(p.first_name) = 'paul'
    and lower(p.last_name) = 'noonan'
    and p.active = true
  order by id
  limit 1
),
club_member as (
  insert into public.club_membership (club_id, person_id, role, active)
  select tt.club_id, rp.id, 'Club Member', true
  from target_team tt
  cross join resolved_person rp
  on conflict (club_id, person_id, role) do update
  set active = true
  returning id, club_id, person_id
),
team_role as (
  insert into public.person_team_role (club_membership_id, person_id, club_id, league_id, team_name, role, active)
  select cm.id, cm.person_id, cm.club_id, tt.league_id, tt.team_name, 'Player', true
  from club_member cm
  cross join target_team tt
  on conflict (person_id, club_id, league_id, team_name, role) do update
  set active = true,
      club_membership_id = excluded.club_membership_id
  returning person_id
)
insert into public.team_membership (team_id, person_id, role, active)
select tt.team_id, tr.person_id, 'Player', true
from target_team tt
cross join team_role tr
on conflict (team_id, person_id, role) do update
set active = true;
