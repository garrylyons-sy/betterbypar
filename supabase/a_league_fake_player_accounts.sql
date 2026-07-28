-- Temporary test access for A League players.
-- Creates fake app login accounts for imported A League players except Garry Lyons.
-- The /home.html?user=... route only accepts @notrealmail.com accounts.

create temporary table tmp_a_league_fake_players on commit drop as
with raw_players as (
  select distinct
    p.id as person_id,
    p.first_name,
    p.last_name,
    c.id as club_id,
    c.name as club_name,
    l.id as league_id,
    t.name as team_name
  from public.team_membership tm
  join public.team t on t.id = tm.team_id
  join public.season s on s.id = t.season_id
  join public.league l on l.id = t.league_id
  join public.club c on c.id = t.club_id
  join public.person p on p.id = tm.person_id
  where s.name = '2025/26'
    and l.name = 'A League'
    and t.name ilike '% A'
    and tm.role = 'Player'
    and tm.active = true
    and p.active = true

  union

  select distinct
    p.id as person_id,
    p.first_name,
    p.last_name,
    c.id as club_id,
    c.name as club_name,
    l.id as league_id,
    ptr.team_name
  from public.person_team_role ptr
  join public.club_membership cm on cm.id = ptr.club_membership_id
  join public.club c on c.id = ptr.club_id
  join public.league l on l.id = ptr.league_id
  join public.person p on p.id = ptr.person_id
  where l.name = 'A League'
    and ptr.team_name ilike '% A'
    and ptr.role = 'Player'
    and ptr.active = true
    and cm.active = true
    and p.active = true
),
normalized as (
  select
    *,
    regexp_replace(lower(first_name), '[^a-z0-9]+', '', 'g')
      || '.'
      || regexp_replace(lower(last_name), '[^a-z0-9]+', '', 'g') as base_username
  from raw_players
  where not (lower(first_name) = 'garry' and lower(last_name) = 'lyons')
),
deduped as (
  select
    *,
    count(*) over (partition by base_username) as duplicate_count
  from normalized
)
select
  person_id,
  first_name,
  last_name,
  club_id,
  club_name,
  league_id,
  team_name,
  case
    when duplicate_count > 1 then base_username || '.' || regexp_replace(lower(team_name), '[^a-z0-9]+', '', 'g')
    else base_username
  end as fake_username,
  case
    when duplicate_count > 1 then base_username || '.' || regexp_replace(lower(team_name), '[^a-z0-9]+', '', 'g')
    else base_username
  end || '@notrealmail.com' as fake_email
from deduped
where base_username <> '.';

update public.person p
set email = fp.fake_email
from tmp_a_league_fake_players fp
where p.id = fp.person_id
  and (p.email is null or lower(p.email) like '%@notrealmail.com')
  and not exists (
    select 1
    from public.person existing_person
    where existing_person.id <> p.id
      and lower(existing_person.email) = fp.fake_email
  );

insert into public.club_membership (club_id, person_id, role, active)
select distinct club_id, person_id, 'Club Member', true
from tmp_a_league_fake_players
on conflict (club_id, person_id, role) do update
set active = true;

insert into public.person_team_role (club_membership_id, person_id, club_id, league_id, team_name, role, active)
select
  cm.id,
  fp.person_id,
  fp.club_id,
  fp.league_id,
  fp.team_name,
  'Player'::public.membership_role,
  true
from tmp_a_league_fake_players fp
join public.club_membership cm
  on cm.club_id = fp.club_id
 and cm.person_id = fp.person_id
 and cm.role = 'Club Member'
on conflict (person_id, club_id, league_id, team_name, role) do update
set active = true;

insert into public.team_membership (team_id, person_id, role, active)
select
  t.id,
  fp.person_id,
  'Player'::public.membership_role,
  true
from tmp_a_league_fake_players fp
join public.season s on s.name = '2026/27'
join public.team t
  on t.season_id = s.id
 and t.league_id = fp.league_id
 and t.club_id = fp.club_id
 and t.name = fp.team_name
on conflict (team_id, person_id, role) do update
set active = true;

insert into public.user_account (person_id, username, password_hash, google_id, active)
select
  fp.person_id,
  fp.fake_username,
  null,
  null,
  true
from tmp_a_league_fake_players fp
join public.person p on p.id = fp.person_id and lower(p.email) = fp.fake_email
where not exists (
  select 1
  from public.user_account ua
  where ua.person_id = fp.person_id
)
on conflict (username) do nothing;

update public.user_account ua
set active = true
from tmp_a_league_fake_players fp
join public.person p on p.id = fp.person_id and lower(p.email) = fp.fake_email
where ua.person_id = fp.person_id;
