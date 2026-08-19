-- Test-only Castle member account with no league team role.
-- This lets /castle-3-lineup exercise the member-only home experience.

with castle as (
  select id
  from public.club
  where name = 'Castle Golf Club'
  limit 1
),
person_upsert as (
  insert into public.person (first_name, last_name, email, active)
  values ('Castle', 'Member', 'castle.member@notrealmail.com', true)
  on conflict (email) do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      active = true
  returning id
),
membership_upsert as (
  insert into public.club_membership (club_id, person_id, role, active)
  select castle.id, person_upsert.id, 'Club Member', true
  from castle, person_upsert
  on conflict (club_id, person_id, role) do update
  set active = true
  returning person_id
)
insert into public.user_account (person_id, username, password_hash, google_id, active)
select person_id, 'castle.member', null, null, true
from membership_upsert
on conflict (username) do update
set active = true;
