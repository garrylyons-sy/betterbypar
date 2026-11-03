begin;
-- Reviews annotate immutable member evidence; they never replace an attestation or score check.
create unique index if not exists golf_drill_session_assignment_target on public.golf_drill_session(assignment_id,id);
create unique index if not exists golf_challenge_attempt_assignment_target on public.golf_challenge_attempt(assignment_id,id);
create table if not exists public.golf_practice_coach_review (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.golf_practice_assignment(id),
 reviewer_person_id uuid not null references public.person(id),
 drill_session_id uuid references public.golf_drill_session(id) on delete cascade,
 challenge_attempt_id uuid references public.golf_challenge_attempt(id) on delete cascade,
 client_key uuid not null,
 outcome text not null check(outcome in ('successful','needs_work','acknowledged')),
 comment text not null check(length(btrim(comment)) between 1 and 2000),
 created_at timestamptz not null default now(),
 check((drill_session_id is not null)::integer+(challenge_attempt_id is not null)::integer=1),
 foreign key(assignment_id,drill_session_id) references public.golf_drill_session(assignment_id,id) on delete cascade,
 foreign key(assignment_id,challenge_attempt_id) references public.golf_challenge_attempt(assignment_id,id) on delete cascade,
 unique(reviewer_person_id,client_key)
);
create index if not exists golf_practice_coach_review_assignment on public.golf_practice_coach_review(assignment_id,created_at desc);
alter table public.golf_practice_coach_review enable row level security;
revoke all on public.golf_practice_coach_review from public,anon,authenticated;
insert into public.golf_challenge(definition) values
 ('{"title":"Par all par threes","description":"Complete every par-three hole in par or better. A complete card must identify hole pars and the scores on each par three.","rule":"par_all_par_threes","targetValue":null}'),
 ('{"title":"No worse than five","description":"Finish every hole in five strokes or fewer. Requires a completed stroke score on every hole.","rule":"hole_score_max","targetValue":5}')
 on conflict do nothing;
commit;
