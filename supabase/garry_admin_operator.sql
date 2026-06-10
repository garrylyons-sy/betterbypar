insert into public.app_operator (person_id, active)
select p.id, true
from public.person p
where lower(p.email) = lower('garlyons@gmail.com')
on conflict (person_id) do update
set active = excluded.active;
