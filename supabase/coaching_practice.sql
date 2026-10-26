begin;
create table if not exists public.golf_challenge (
 id uuid primary key default gen_random_uuid(), club_id uuid references public.club(id),
 created_by uuid references public.person(id), definition jsonb not null, active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.golf_drill (
 id uuid primary key default gen_random_uuid(), club_id uuid references public.club(id),
 created_by uuid references public.person(id), definition jsonb not null, active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index if not exists golf_challenge_builtin on public.golf_challenge((definition->>'title')) where club_id is null;
create unique index if not exists golf_drill_builtin on public.golf_drill((definition->>'title')) where club_id is null;
create table if not exists public.golf_practice_assignment (
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.club(id),
 player_person_id uuid not null references public.person(id),coach_person_id uuid not null references public.person(id),
 created_by uuid not null references public.person(id),client_key uuid not null,
 kind text not null check(kind in ('challenge','drill')),
 challenge_id uuid references public.golf_challenge(id),drill_id uuid references public.golf_drill(id),
 definition jsonb not null, notes text not null default '',
 starts_on date not null,due_on date,target_holes integer not null default 18 check(target_holes in (9,18)),
 goal_sessions integer not null default 3 check(goal_sessions between 1 and 30),
 status text not null default 'active' check(status in ('active','cancelled')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((kind='challenge' and challenge_id is not null and drill_id is null) or (kind='drill' and drill_id is not null and challenge_id is null)),
 check(due_on is null or due_on>=starts_on),unique(created_by,client_key)
);
create table if not exists public.golf_challenge_attempt (
 id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.golf_practice_assignment(id),
 actor_person_id uuid not null references public.person(id),client_key uuid not null,
 round_id uuid references public.golf_round(id) on delete cascade,round_revision integer,
 performed_on date not null,result jsonb not null,attested boolean not null default false,note text not null default '',
 created_at timestamptz not null default now(),unique(assignment_id,client_key)
);
create table if not exists public.golf_drill_session (
 id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.golf_practice_assignment(id),
 actor_person_id uuid not null references public.person(id),client_key uuid not null,
 performed_on date not null,minutes integer not null check(minutes between 1 and 180),note text not null default '',
 created_at timestamptz not null default now(),unique(assignment_id,client_key)
);
create index if not exists golf_practice_player on public.golf_practice_assignment(club_id,player_person_id,created_at desc);
create index if not exists golf_challenge_attempt_latest on public.golf_challenge_attempt(assignment_id,created_at desc);
create index if not exists golf_drill_session_assignment on public.golf_drill_session(assignment_id);
alter table public.golf_challenge enable row level security;
alter table public.golf_drill enable row level security;
alter table public.golf_practice_assignment enable row level security;
alter table public.golf_challenge_attempt enable row level security;
alter table public.golf_drill_session enable row level security;
revoke all on public.golf_challenge,public.golf_drill,public.golf_practice_assignment,public.golf_challenge_attempt,public.golf_drill_session from public,anon,authenticated;
insert into public.golf_challenge(definition) values
 ('{"title":"No three-putts","description":"Complete your assigned round with fewer than three putts on every hole. Putt counts must be recorded or the result attested.","rule":"no_three_putts","targetValue":null}'),
 ('{"title":"No double bogeys","description":"Finish every hole better than double bogey. Requires completed strokes and par on every hole, or attestation if par is unavailable.","rule":"no_double_bogeys","targetValue":null}'),
 ('{"title":"No lost balls","description":"Complete the assigned number of holes without losing a ball. Confirm the result yourself; a penalty count cannot prove whether a ball was lost.","rule":"no_lost_balls","targetValue":null}'),
 ('{"title":"Break 90","description":"Record 89 strokes or fewer over the assigned round. A complete imported Golf Ireland card can supply the scoring evidence.","rule":"gross_max","targetValue":89}')
 on conflict do nothing;
insert into public.golf_drill(definition) values
 ('{"title":"Putting gate","category":"Putting","description":"Practise starting short putts through a narrow gate with a clear target.","steps":["On a practice green, put two tees slightly wider than your putter head.","Place a ball between the tees and choose a short target.","Roll ten balls through the gate. Reset and repeat."],"demoUrl":"/practice/demos/putting-gate","minutes":10,"repetitions":20,"successCriteria":"Record how many starts pass cleanly through the gate."}'),
 ('{"title":"Distance ladder","category":"Putting","description":"Develop pace awareness by rolling balls to progressively longer targets.","steps":["Mark three target zones at increasing distances on a practice green.","Roll one ball to each zone, from nearest to furthest.","Repeat the ladder and note which distance needs attention."],"demoUrl":"/practice/demos/distance-ladder","minutes":12,"repetitions":15,"successCriteria":"Record how many balls finish in the chosen target zone."}'),
 ('{"title":"Landing-zone chipping","category":"Short game","description":"Choose a landing area and observe how the ball releases towards your target.","steps":["Choose a safe practice area and mark a small landing zone.","Chip five balls, aiming to land each inside that zone.","Observe the release, adjust the chosen zone and repeat."],"demoUrl":"/practice/demos/landing-zone","minutes":15,"repetitions":15,"successCriteria":"Record successful landings and what you noticed about the release."}')
 on conflict do nothing;
alter table public.app_notification drop constraint if exists app_notification_type_check;
alter table public.app_notification add constraint app_notification_type_check check(type in ('fixture_change','match_reminder','lineup_reminder','ladder_challenge','announcement','lineup_published','match_result','cup_draw','livestream','lesson_booking','lesson_reminder','lesson_cancelled','lesson_feedback','coaching_assignment','coaching_progress','round_comment'));
commit;
