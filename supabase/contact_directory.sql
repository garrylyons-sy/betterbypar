create table if not exists public.contact_directory (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.person(id) on delete cascade,
  contact_type text not null check (contact_type in ('League Official', 'Team Contact', 'Club Contact')),
  contact_label text not null,
  club_id uuid references public.club(id) on delete cascade,
  league_id uuid references public.league(id) on delete restrict,
  team_name text,
  phone_override text,
  sort_order integer not null default 1000,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contact_directory_person_label_idx
  on public.contact_directory (person_id, contact_type, contact_label);

create index if not exists contact_directory_active_sort_idx
  on public.contact_directory (active, sort_order, contact_type);

alter table public.contact_directory enable row level security;

drop policy if exists "managers can read contact directory" on public.contact_directory;
create policy "managers can read contact directory" on public.contact_directory
  for select to authenticated
  using (
    active = true
    and (
      public.is_app_operator()
      or exists (
        select 1
        from public.club_admin ca
        where ca.person_id = public.current_person_id()
          and ca.active = true
      )
      or exists (
        select 1
        from public.club_membership cm
        where cm.person_id = public.current_person_id()
          and cm.active = true
          and cm.is_club_admin = true
      )
      or exists (
        select 1
        from public.person_team_role ptr
        where ptr.person_id = public.current_person_id()
          and ptr.active = true
          and ptr.role = 'Manager'
      )
    )
  );

with seed(contact_type, contact_label, person_name, club_key, league_name, team_name, phone, sort_order) as (
  values
    ('League Official', 'Chairman', 'Mark Byrne', null, null, null, '0862632213', 10),
    ('Team Contact', 'Castle A', 'Stephen Finlan', 'Castle', 'A League', 'Castle A', '0876738718', 110),
    ('Team Contact', 'Castle B', 'Hilary Haydon', 'Castle', 'B League', 'Castle B', '0872585619', 120),
    ('Team Contact', 'Castle C', 'Brian Gaw', 'Castle', 'C League', 'Castle C', '0868842027', 130),
    ('Team Contact', 'Castle D', 'Paul Noonan', 'Castle', 'C League', 'Castle D', '0872632226', 140),
    ('Team Contact', 'Grange A', 'Mick Meade', 'Grange', 'A League', 'Grange A', '0872476350', 210),
    ('Team Contact', 'Grange B', 'Morgan Pierse', 'Grange', 'B League', 'Grange B', '0872229537', 220),
    ('Team Contact', 'Grange C', 'Mick Collins', 'Grange', 'C League', 'Grange C', '0872055302', 230),
    ('Team Contact', 'Grange D', 'Noel O''Kelly', 'Grange', 'C League', 'Grange D', '087 1233200', 240),
    ('Team Contact', 'Dun Laoghaire A', 'Ryan Berkeley', 'Dun Laoghaire', 'A League', 'Dun Laoghaire A', '0872182942', 310),
    ('Team Contact', 'Elm Park A', 'Conor O''Boyle', 'Elm Park', 'A League', 'Elm Park A', '0879008258', 410),
    ('Team Contact', 'Elm Park B', 'Bryan Kilty', 'Elm Park', 'B League', 'Elm Park B', '0876890890', 420),
    ('Team Contact', 'Elm Park C', 'Rory Butler', 'Elm Park', 'C League', 'Elm Park C', '0868381749', 430),
    ('Team Contact', 'Milltown A', 'Alan Donnelly', 'Milltown', 'A League', 'Milltown A', '0879908990', 510),
    ('Team Contact', 'Milltown B', 'Colin Byrne', 'Milltown', 'B League', 'Milltown B', '0872330065', 520),
    ('Team Contact', 'Milltown B & C', 'James McGovern', 'Milltown', null, 'Milltown B & C', '0858707865', 521),
    ('Team Contact', 'Milltown B & C', 'Brendan McVeigh', 'Milltown', null, 'Milltown B & C', '0877780864', 522),
    ('Team Contact', 'Newlands A', 'Peter Myles', 'Newlands', 'A League', 'Newlands A', '0879825127', 610),
    ('Team Contact', 'Newlands B', 'Mick Tolan', 'Newlands', 'B League', 'Newlands B', '0872705949', 620),
    ('Team Contact', 'Newlands C', 'Cyril Dolan', 'Newlands', 'C League', 'Newlands C', '0868537323', 630),
    ('Team Contact', 'Stackstown A', 'Noel Brennan', 'Stackstown', 'A League', 'Stackstown A', '0868490097', 710),
    ('Team Contact', 'Stackstown B', 'Mick Travers', 'Stackstown', 'B League', 'Stackstown B', '0872473148', 720),
    ('Team Contact', 'Stackstown C', 'Carl Keenan', 'Stackstown', 'C League', 'Stackstown C', '0862311066', 730),
    ('Team Contact', 'Woodbrook A', 'John Darcy', 'Woodbrook', 'A League', 'Woodbrook A', '0872257195', 810),
    ('Team Contact', 'Woodbrook B', 'Robert Argue', 'Woodbrook', 'B League', 'Woodbrook B', '0872598032', 820),
    ('Team Contact', 'Fitzwilliam B', 'Harry Brophy', 'Fitzwilliam', 'B League', 'Fitzwilliam B', '0868222220', 910),
    ('Team Contact', 'Fitzwilliam B', 'Gareth Colgan', 'Fitzwilliam', 'B League', 'Fitzwilliam B', '0872336300', 911),
    ('Team Contact', 'Fitzwilliam C', 'Richard Flinn', 'Fitzwilliam', 'C League', 'Fitzwilliam C', '00447884265539', 920),
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
    select club.id
    from public.club
    where seed.club_key is not null
      and (
        lower(club.name) = lower(seed.club_key)
        or lower(club.name) like lower(seed.club_key || '%')
      )
    order by length(club.name)
    limit 1
  ) c on true
  left join public.league l on l.name = seed.league_name
  join lateral (
    select person.id
    from public.person
    left join public.club_membership cm on cm.person_id = person.id and cm.active = true
    left join public.person_team_role ptr on ptr.person_id = person.id and ptr.active = true
    where regexp_replace(lower(concat_ws(' ', person.first_name, person.last_name)), '[^a-z0-9]+', '', 'g')
      = regexp_replace(lower(seed.person_name), '[^a-z0-9]+', '', 'g')
      and (
        seed.club_key is null
        or cm.club_id = c.id
        or ptr.club_id = c.id
      )
    order by
      case when cm.club_id = c.id or ptr.club_id = c.id then 0 else 1 end,
      person.created_at
    limit 1
  ) p on true
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
on conflict (person_id, contact_type, contact_label)
do update set
  club_id = excluded.club_id,
  league_id = excluded.league_id,
  team_name = excluded.team_name,
  phone_override = excluded.phone_override,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

update public.contact_directory cd
   set active = false,
       updated_at = now()
  from public.person p
 where p.id = cd.person_id
   and cd.contact_type = 'Team Contact'
   and cd.contact_label = 'Grange B'
   and regexp_replace(lower(concat_ws(' ', p.first_name, p.last_name)), '[^a-z0-9]+', '', 'g') = 'mickcollins';

update public.contact_directory cd
   set active = false,
       updated_at = now()
  from public.person p
 where p.id = cd.person_id
   and cd.contact_type = 'Team Contact'
   and cd.contact_label = 'Grange C'
   and regexp_replace(lower(concat_ws(' ', p.first_name, p.last_name)), '[^a-z0-9]+', '', 'g') = 'morganpierse';

update public.contact_directory cd
   set active = false,
       updated_at = now()
  from public.person p
 where p.id = cd.person_id
   and cd.contact_type = 'Team Contact'
   and cd.contact_label = 'Milltown B & C'
   and regexp_replace(lower(concat_ws(' ', p.first_name, p.last_name)), '[^a-z0-9]+', '', 'g') = 'colinbyrne';
