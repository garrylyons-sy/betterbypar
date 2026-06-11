-- Generated from the 2025/26 A League team/player roster.
-- Creates people only when they do not already exist, then assigns Player memberships.
-- Historical roster imports do not create login accounts.

create temporary table source_roster (
  team_name text not null,
  first_name text not null,
  last_name text not null
) on commit drop;

insert into source_roster (team_name, first_name, last_name)
values
    ('Castle A', 'Declan', 'McNiff'),
    ('Castle A', 'Garry', 'Lyons'),
    ('Castle A', 'Eric', 'Goodwin'),
    ('Castle A', 'Fergal', 'Behan'),
    ('Castle A', 'Graham', 'Walsh'),
    ('Castle A', 'Ross', 'McKeever'),
    ('Castle A', 'Niall', 'McNiff'),
    ('Castle A', 'Karl', 'Ward'),
    ('Castle A', 'Mark', 'Byrne'),
    ('Castle A', 'Niall', 'O''Brien'),
    ('Castle A', 'Gerry', 'Kane'),
    ('Castle A', 'Stephen', 'Finlan'),
    ('Dun Laoghaire A', 'Ryan', 'Berkeley'),
    ('Dun Laoghaire A', 'David', 'Round'),
    ('Dun Laoghaire A', 'John', 'Farrell'),
    ('Dun Laoghaire A', 'Paul', 'Dean'),
    ('Dun Laoghaire A', 'Dave', 'McGrath'),
    ('Dun Laoghaire A', 'Kevin', 'Donnelly'),
    ('Dun Laoghaire A', 'Robin', 'Sutton'),
    ('Dun Laoghaire A', 'Brendan', 'McNestry'),
    ('Dun Laoghaire A', 'Marcus', 'Vaughan'),
    ('Dun Laoghaire A', 'John', 'Rogers'),
    ('Dun Laoghaire A', 'Dave', 'Stephens'),
    ('Dun Laoghaire A', 'Ethan', 'Sutton'),
    ('Dun Laoghaire A', 'John', 'Woodroofe'),
    ('Dun Laoghaire A', 'Daithi', 'M'),
    ('Elm Park A', 'Conor', 'O''Boyle'),
    ('Elm Park A', 'Gareth', 'Ryan'),
    ('Elm Park A', 'Malcolm', 'Carrigy'),
    ('Elm Park A', 'Aidan', 'Claffey'),
    ('Elm Park A', 'Aidan', 'Maher'),
    ('Elm Park A', 'Mark', 'Kelly'),
    ('Elm Park A', 'Declan', 'Kilroy'),
    ('Elm Park A', 'Dara', 'O''Gaora'),
    ('Elm Park A', 'Mark', 'Poland'),
    ('Elm Park A', 'Peter', 'Cosgrove'),
    ('Elm Park A', 'Michael', 'Byers'),
    ('Elm Park A', 'Pat', 'O''Hara'),
    ('Elm Park A', 'Brian', 'Kilty'),
    ('Elm Park A', 'Owen', 'McDermott'),
    ('Fitzwilliam A', 'Brian', 'Daly'),
    ('Fitzwilliam A', 'Justin', 'Smyth'),
    ('Fitzwilliam A', 'Conor', 'O''Hare'),
    ('Fitzwilliam A', 'Andrew', 'Foley'),
    ('Fitzwilliam A', 'Richie', 'Allen'),
    ('Fitzwilliam A', 'Igor', 'Fleming'),
    ('Fitzwilliam A', 'Conor', 'McCabe'),
    ('Fitzwilliam A', 'Liam', 'McCabe'),
    ('Fitzwilliam A', 'Frank', 'Kinsella'),
    ('Fitzwilliam A', 'Gareth', 'Colgan'),
    ('Fitzwilliam A', 'Eddie', 'McCarron'),
    ('Fitzwilliam A', 'Jonathan', 'Doyle'),
    ('Fitzwilliam A', 'Kevin', 'Burke'),
    ('Fitzwilliam A', 'John', 'Donegan'),
    ('Fitzwilliam A', 'Jonathan', 'Daly'),
    ('Fitzwilliam A', 'Richard', 'Flynn'),
    ('Fitzwilliam A', 'Alistair', 'Brown'),
    ('Fitzwilliam A', 'Andrew', 'Flynn'),
    ('Fitzwilliam A', 'Harry', 'Brophy'),
    ('Fitzwilliam A', 'John', 'Flavin'),
    ('Fitzwilliam A', 'Mark', 'Deering'),
    ('Fitzwilliam A', 'Mike', 'Kemp'),
    ('Fitzwilliam A', 'Nathan', 'Daly'),
    ('Fitzwilliam A', 'Niall', 'McCarvill'),
    ('Fitzwilliam A', 'Paul', 'Nugent'),
    ('Fitzwilliam A', 'Roddy', 'Feely'),
    ('Grange A', 'Dave', 'Healy'),
    ('Grange A', 'Matt', 'Kavanagh'),
    ('Grange A', 'Mick', 'McDermott'),
    ('Grange A', 'Ger', 'Gormley'),
    ('Grange A', 'Mick', 'Meade'),
    ('Grange A', 'John', 'Butler'),
    ('Grange A', 'Plunkett', 'Walsh'),
    ('Grange A', 'Alan', 'Cooke'),
    ('Grange A', 'Rob', 'Buckley'),
    ('Grange A', 'Martyn', 'Evans'),
    ('Grange A', 'Dave', 'Sweetman'),
    ('Grange A', 'Owen', 'Welsh'),
    ('Grange A', 'Jack', 'Wright'),
    ('Milltown A', 'Dave', 'O''Riordan'),
    ('Milltown A', 'Alan', 'Donnelly'),
    ('Milltown A', 'Cian', 'O''Reilly'),
    ('Milltown A', 'Brian', 'Taite'),
    ('Milltown A', 'Joe', 'Egan'),
    ('Milltown A', 'Rory', 'Nolan'),
    ('Milltown A', 'Kevin', 'Farrell'),
    ('Milltown A', 'Harry', 'Fanagan'),
    ('Milltown A', 'Ian', 'Kiernan'),
    ('Milltown A', 'Jody', 'Fanagan'),
    ('Milltown A', 'Francis', 'Fullen'),
    ('Milltown A', 'Gary', 'Gleeson'),
    ('Milltown A', 'Andrew', 'Cloonan'),
    ('Milltown A', 'Roger', 'Coleman'),
    ('Newlands A', 'Jimmy', 'Harlow'),
    ('Newlands A', 'Damien', 'Long'),
    ('Newlands A', 'David', 'Naughton'),
    ('Newlands A', 'Peter', 'Myles'),
    ('Newlands A', 'Maurice', 'Ebbs'),
    ('Newlands A', 'Steve', 'Cooke'),
    ('Newlands A', 'Conor', 'Faughnan'),
    ('Newlands A', 'Graham', 'McHugh'),
    ('Newlands A', 'Mark', 'Carroll'),
    ('Newlands A', 'Barry', 'Warren'),
    ('Stackstown A', 'Brendan', 'Sweeney'),
    ('Stackstown A', 'Conor', 'Logan'),
    ('Stackstown A', 'James', 'Anett'),
    ('Stackstown A', 'Mick', 'Travers'),
    ('Stackstown A', 'Dara', 'Carey'),
    ('Stackstown A', 'Paul', 'O''Donaghue'),
    ('Stackstown A', 'Jonathan', 'Rutledge'),
    ('Stackstown A', 'Conor', 'O''Riordan'),
    ('Stackstown A', 'Dave', 'Redmond'),
    ('Stackstown A', 'Peadar', 'Hogan'),
    ('Stackstown A', 'Aidan', 'Farrell'),
    ('Stackstown A', 'Noel', 'Brennan'),
    ('Stackstown A', 'Alan', 'Stephens'),
    ('Stackstown A', 'Brian', 'Kennedy'),
    ('Stackstown A', 'Diarmuid', 'Kennan'),
    ('Woodbrook A', 'Brian', 'Quigley'),
    ('Woodbrook A', 'Conor', 'Murray'),
    ('Woodbrook A', 'Barry', 'Maher'),
    ('Woodbrook A', 'Scott', 'Maher'),
    ('Woodbrook A', 'John', 'Darcy'),
    ('Woodbrook A', 'Stephen', 'Hughes'),
    ('Woodbrook A', 'Stephen', 'Maher'),
    ('Woodbrook A', 'Des', 'Noctor'),
    ('Woodbrook A', 'Paul', 'Ludden'),
    ('Woodbrook A', 'Brian', 'd''Arcy'),
    ('Woodbrook A', 'Conor', 'Maher');

insert into public.person (first_name, last_name, active)
select distinct sr.first_name, sr.last_name, true
from source_roster sr
where not exists (
  select 1
  from public.person p
  where lower(p.first_name) = lower(sr.first_name)
    and lower(p.last_name) = lower(sr.last_name)
)
on conflict do nothing;

with people as (
  select distinct on (lower(first_name), lower(last_name))
    id,
    first_name,
    last_name
  from public.person
  order by lower(first_name), lower(last_name), created_at asc
),
resolved as (
  select
    t.id as team_id,
    p.id as person_id,
    c.id as club_id
  from source_roster sr
  join public.season s on s.name = '2025/26'
  join public.league l on l.name = 'A League'
  join public.team t on t.name = sr.team_name
    and t.season_id = s.id
    and t.league_id = l.id
  join public.club c on c.id = t.club_id
  join people p on lower(p.first_name) = lower(sr.first_name)
    and lower(p.last_name) = lower(sr.last_name)
)
insert into public.team_membership (team_id, person_id, role, joined_date, active)
select team_id, person_id, 'Player'::membership_role, '2025-09-01', true
from resolved
on conflict (team_id, person_id, role) do update
set joined_date = excluded.joined_date,
    active = excluded.active;

with people as (
  select distinct on (lower(first_name), lower(last_name))
    id,
    first_name,
    last_name
  from public.person
  order by lower(first_name), lower(last_name), created_at asc
),
resolved as (
  select distinct
    c.id as club_id,
    p.id as person_id
  from source_roster sr
  join public.season s on s.name = '2025/26'
  join public.league l on l.name = 'A League'
  join public.team t on t.name = sr.team_name
    and t.season_id = s.id
    and t.league_id = l.id
  join public.club c on c.id = t.club_id
  join people p on lower(p.first_name) = lower(sr.first_name)
    and lower(p.last_name) = lower(sr.last_name)
)
insert into public.club_membership (club_id, person_id, role, joined_date, active)
select club_id, person_id, 'Club Member', '2025-09-01', true
from resolved
on conflict (club_id, person_id, role) do update
set joined_date = excluded.joined_date,
    active = excluded.active;
