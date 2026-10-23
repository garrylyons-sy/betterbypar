begin;
create table if not exists public.cup_draw_notification_send (
 id uuid primary key,
 competition_id uuid not null references public.cup_competition(id) on delete cascade,
 attempt_id uuid not null references public.cup_draw_attempt(id) on delete cascade,
 sender_person_id uuid references public.person(id) on delete set null,
 request_fingerprint text not null,
 audience jsonb not null,
 summary jsonb not null,
 recipients jsonb not null,
 created_at timestamptz not null default now()
);
create index if not exists cup_draw_notification_send_history on public.cup_draw_notification_send(competition_id,attempt_id,created_at desc);
alter table public.cup_draw_notification_send enable row level security;
revoke all on public.cup_draw_notification_send from anon,authenticated;
comment on table public.cup_draw_notification_send is 'Server-only audit and retry protection for manually sent confirmed cup draws. Original confirmation notification remains on cup_draw_attempt.';
commit;
