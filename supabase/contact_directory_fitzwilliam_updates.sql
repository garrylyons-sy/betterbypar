with old_igor as (
  select cd.id
  from public.contact_directory cd
  join public.person p on p.id = cd.person_id
  where cd.contact_type = 'Team Contact'
    and cd.contact_label = 'Fitzwilliam B'
    and lower(p.first_name) = 'igor'
    and lower(p.last_name) = 'fleming'
)
update public.contact_directory cd
   set active = false,
       updated_at = now()
  from old_igor
 where cd.id = old_igor.id;

with seed(contact_type, contact_label, person_name, club_name, league_name, team_name, phone, sort_order) as (
  values
    ('Team Contact', 'Fitzwilliam B', 'Harry Brophy', 'Fitzwilliam', 'B League', 'Fitzwilliam B', '0868222220', 910),
    ('Team Contact', 'Fitzwilliam C', 'Eddie McCarron', 'Fitzwilliam', 'C League', 'Fitzwilliam C', '0869571199', 921)
),
resolved as (
  select
    seed.*,
    p.id as person_id,
    c.id as club_id,
    l.id as league_id
  from seed
  left join lateral (
    select person.id
    from public.person person
    where lower(concat_ws(' ', person.first_name, person.last_name)) = lower(seed.person_name)
    order by person.active desc, person.created_at desc
    limit 1
  ) p on true
  left join public.club c on lower(c.name) like lower(seed.club_name || '%')
  left join public.league l on l.name = seed.league_name
),
phone_updates as (
  update public.person person
     set phone = resolved.phone
    from resolved
   where person.id = resolved.person_id
     and nullif(resolved.phone, '') is not null
     and nullif(person.phone, '') is null
  returning person.id
)
insert into public.contact_directory (
  person_id,
  contact_type,
  contact_label,
  club_id,
  league_id,
  team_name,
  phone_override,
  sort_order,
  active
)
select
  person_id,
  contact_type,
  contact_label,
  club_id,
  league_id,
  team_name,
  phone,
  sort_order,
  true
from resolved
where person_id is not null
on conflict (person_id, contact_type, contact_label)
do update set
  club_id = excluded.club_id,
  league_id = excluded.league_id,
  team_name = excluded.team_name,
  phone_override = excluded.phone_override,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();
