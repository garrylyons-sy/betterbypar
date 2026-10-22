-- Standalone publishing permission; independent of club/team memberships.
begin;
create table if not exists public.app_publisher (
 person_id uuid primary key references public.person(id) on delete cascade,
 active boolean not null default true,
 assigned_by uuid references public.person(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.app_publisher enable row level security;
revoke all privileges on public.app_publisher from public, anon, authenticated;
comment on table public.app_publisher is 'Standalone permission to compose audience-targeted announcements in the core app. Assigned only by platform administrators.';
commit;
