-- YouTube owns media delivery. These protected tables only hold permissions/listings.
begin;
create table if not exists public.app_viewer (
 person_id uuid primary key references public.person(id) on delete cascade,
 active boolean not null default true,
 assigned_by uuid references public.person(id) on delete set null,
 updated_at timestamptz not null default now()
);
create table if not exists public.match_livestream (
 id uuid primary key default gen_random_uuid(),
 fixture_id uuid not null references public.fixture(id) on delete cascade,
 publisher_person_id uuid not null references public.person(id) on delete cascade,
 youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
 started_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '12 hours',
 ended_at timestamptz,
 check(expires_at > started_at)
);
create unique index if not exists match_livestream_one_live_fixture on public.match_livestream(fixture_id) where ended_at is null;
create index if not exists match_livestream_owner on public.match_livestream(publisher_person_id,started_at desc);
alter table public.app_viewer enable row level security;
alter table public.match_livestream enable row level security;
revoke all privileges on public.app_viewer, public.match_livestream from public, anon, authenticated;
comment on table public.app_viewer is 'Standalone Viewing permission for livestreams, assigned by platform administrators only.';
comment on table public.match_livestream is 'Publisher-owned YouTube fixture listings; no video is hosted or proxied by the app.';
commit;
