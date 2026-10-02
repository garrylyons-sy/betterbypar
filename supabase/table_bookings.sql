create table if not exists public.club_table (
  table_id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete cascade,
  table_name text not null,
  table_description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (club_id, table_name),
  unique (table_id, club_id)
);

comment on table public.club_table is 'Snooker tables available for member booking at a club.';

create table if not exists public.club_membership (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete cascade,
  role text not null default 'Club Member' check (role in ('Club Member', 'Club Admin', 'League Chair')),
  joined_date date not null default current_date,
  is_club_admin boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (club_id, person_id, role)
);

comment on table public.club_membership is 'Club-level membership for people who can receive club messages and book club tables without belonging to a league team.';

create table if not exists public.table_booking (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete cascade,
  table_id uuid not null,
  person_id uuid not null references public.person(id) on delete cascade,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.person(id) on delete set null,
  foreign key (table_id, club_id) references public.club_table(table_id, club_id) on delete cascade,
  check (start_time >= time '11:00' and start_time < time '23:00'),
  check (end_time = start_time + interval '1 hour'),
  check (cancelled_at is null or cancelled_by is not null)
);

create unique index if not exists table_booking_active_slot_idx
on public.table_booking (table_id, booking_date, start_time)
where cancelled_at is null;

create index if not exists table_booking_club_date_idx on public.table_booking (club_id, booking_date, start_time);
create index if not exists table_booking_person_date_idx on public.table_booking (person_id, booking_date desc);

comment on table public.table_booking is 'One-hour member snooker table bookings. Active bookings are unique per table, date and start time.';

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

alter table public.club_table enable row level security;
alter table public.club_membership enable row level security;
alter table public.table_booking enable row level security;

drop policy if exists "authenticated users can read club tables" on public.club_table;
create policy "authenticated users can read club tables" on public.club_table
for select to authenticated
using (active = true);

drop policy if exists "members can read club memberships" on public.club_membership;
create policy "members can read club memberships" on public.club_membership
for select to authenticated
using (active = true);

drop policy if exists "operators can read all club memberships" on public.club_membership;
create policy "operators can read all club memberships" on public.club_membership
for select to authenticated
using (public.is_app_operator());

drop policy if exists "members can read table bookings" on public.table_booking;
create policy "members can read table bookings" on public.table_booking
for select to authenticated
using (cancelled_at is null);

insert into public.club_membership (club_id, person_id, role, active)
select c.id, p.id, 'Club Member', true
from public.club c
join public.person p on lower(p.email) = lower('garlyons@gmail.com')
where c.name = 'Castle Golf Club'
on conflict (club_id, person_id, role) do update
set active = excluded.active;
