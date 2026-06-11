with garry as (
  insert into public.person (first_name, last_name, email, active)
  values ('Garry', 'Lyons', 'garlyons@gmail.com', true)
  on conflict (email) do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      active = true
  returning id
),
castle_c_team as (
  insert into public.team (club_id, league_id, season_id, name, active)
  select c.id, l.id, s.id, 'Castle C', true
  from public.club c
  join public.league l on l.name = 'C League'
  join public.season s on s.name = '2025/26'
  where c.name = 'Castle Golf Club'
  on conflict (league_id, season_id, name) do update
  set active = true
  returning id
),
target_roles as (
  select t.id as team_id, 'Player'::public.membership_role as role
  from public.team t
  join public.club c on c.id = t.club_id
  join public.league l on l.id = t.league_id
  join public.season s on s.id = t.season_id
  where c.name = 'Castle Golf Club'
    and l.name = 'A League'
    and s.name = '2025/26'
    and t.name = 'Castle A'
  union all
  select id as team_id, 'Manager'::public.membership_role as role
  from castle_c_team
),
disabled_other_roles as (
  update public.team_membership tm
  set active = false
  from garry g
  where tm.person_id = g.id
    and not exists (
      select 1
      from target_roles tr
      where tr.team_id = tm.team_id
        and tr.role = tm.role
    )
  returning tm.id
)
insert into public.team_membership (team_id, person_id, role, active)
select tr.team_id, g.id, tr.role, true
from target_roles tr
cross join garry g
on conflict (team_id, person_id, role) do update
set active = true,
    joined_date = public.team_membership.joined_date;
