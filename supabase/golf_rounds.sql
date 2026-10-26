-- Private round journal. Access is checked by app-owned sessions on the server.
create table if not exists public.golf_round (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.club(id),
 player_person_id uuid not null references public.person(id),
 created_by uuid not null references public.person(id),
 source text not null check(source in ('manual','golf_ireland','demo_golf_ireland')),
 external_score_uid text,
 data jsonb not null check(jsonb_typeof(data)='object'),
 imported_gross integer check(imported_gross between 1 and 540),
 imported_points integer check(imported_points between 0 and 150),
 revision integer not null default 1 check(revision>0),
 feedback jsonb,
 feedback_revision integer,
 feedback_generated_at timestamptz,
 feedback_requested_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((source='manual' and external_score_uid is null) or (source<>'manual' and external_score_uid is not null)),
 unique(player_person_id,source,external_score_uid)
);
create index if not exists golf_round_player_club on public.golf_round(player_person_id,club_id,updated_at desc);
alter table public.golf_round enable row level security;
revoke all on public.golf_round from public,anon,authenticated;
