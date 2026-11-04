-- Player-entered courses stay private until a platform administrator publishes a verified scorecard.
create table if not exists public.golf_course_submission (
 id uuid primary key default gen_random_uuid(),
 round_id uuid not null references public.golf_round(id) on delete cascade,
 club_id uuid not null references public.club(id),
 submitted_by uuid not null references public.person(id),
 course_name text not null check(length(course_name) between 1 and 160),
 tee_name text not null default '' check(length(tee_name)<=80),
 course_key text generated always as (lower(trim(course_name))) stored,
 tee_key text generated always as (lower(trim(tee_name))) stored,
 snapshot jsonb not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references public.person(id),
 reviewed_at timestamptz,
 review_note text not null default '' check(length(review_note)<=2000),
 published_course_id uuid references public.golf_course(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(submitted_by,course_key,tee_key),
 check((status='pending' and reviewed_by is null and reviewed_at is null) or (status<>'pending' and reviewed_by is not null and reviewed_at is not null))
);
alter table public.golf_course_submission enable row level security;
revoke all on public.golf_course_submission from public,anon,authenticated;
create index if not exists golf_course_submission_pending on public.golf_course_submission(created_at) where status='pending';
