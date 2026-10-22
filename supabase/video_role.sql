-- Video is independent of Publisher (messaging) and Viewing (playback).
-- Nobody receives this permission automatically.
begin;
create table if not exists public.app_video (
 person_id uuid primary key references public.person(id) on delete cascade,
 active boolean not null default true,
 assigned_by uuid references public.person(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.app_video enable row level security;
revoke all privileges on public.app_video from public, anon, authenticated;
comment on table public.app_video is 'Standalone permission to create/manage owned YouTube match livestream listings, assigned only by platform administrators. Independent of Publisher and Viewing.';
commit;
