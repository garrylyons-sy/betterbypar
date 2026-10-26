begin;
create or replace function public.is_round_coach(actor uuid,cid uuid,pid uuid) returns boolean language sql stable set search_path=public as $$
 select exists(select 1 from club_membership cm join person p on p.id=cm.person_id and p.active join club c on c.id=cm.club_id and c.active
 where cm.person_id=actor and cm.club_id=cid and cm.active and cm.role in ('Golf Professional','Assistant Professional') and public.is_golf_player(pid,cid) and (
 exists(select 1 from lesson_booking b join lesson_slot s on s.id=b.slot_id where b.player_person_id=pid and b.status='Booked' and s.club_id=cid and s.professional_person_id=actor)
 or exists(select 1 from lesson_group g join lesson_group_member m on m.group_id=g.id and m.active where g.active and g.club_id=cid and g.professional_person_id=actor and m.person_id=pid)
 or exists(select 1 from golf_practice_assignment a where a.club_id=cid and a.player_person_id=pid and a.coach_person_id=actor and a.status='active')))
$$;
create or replace function public.can_discuss_round(actor uuid,rid uuid) returns boolean language sql stable set search_path=public as $$
 select exists(select 1 from golf_round r join club c on c.id=r.club_id and c.active where r.id=rid and r.data->>'status'='completed' and public.is_golf_player(r.player_person_id,r.club_id) and (
 public.is_round_coach(actor,r.club_id,r.player_person_id) or exists(select 1 from club_membership cm join person p on p.id=cm.person_id and p.active where cm.person_id=actor and cm.club_id=r.club_id and cm.active and (actor=r.player_person_id or exists(select 1 from dependants d where d.club_id=r.club_id and d.guardian_person_id=actor and d.dependant_person_id=r.player_person_id and d.active)))))
$$;
revoke all on function public.is_round_coach(uuid,uuid,uuid),public.can_discuss_round(uuid,uuid) from public,anon,authenticated;
create table if not exists public.golf_round_comment (
 id uuid primary key default gen_random_uuid(),round_id uuid not null references public.golf_round(id) on delete cascade,
 author_person_id uuid not null references public.person(id),client_key uuid not null,round_revision integer not null check(round_revision>0),
 hole_number integer check(hole_number between 1 and 18),body text not null check(length(trim(body)) between 1 and 3000),
 created_at timestamptz not null default now(),unique(author_person_id,client_key)
);
alter table public.golf_practice_assignment add column if not exists source_round_id uuid references public.golf_round(id) on delete set null;
create index if not exists golf_round_comment_round_idx on public.golf_round_comment(round_id,created_at);
alter table public.golf_round_comment enable row level security;
revoke all on public.golf_round_comment from public,anon,authenticated;
alter table public.app_notification drop constraint if exists app_notification_type_check;
alter table public.app_notification add constraint app_notification_type_check check(type in ('fixture_change','match_reminder','lineup_reminder','ladder_challenge','announcement','lineup_published','match_result','cup_draw','livestream','lesson_booking','lesson_reminder','lesson_cancelled','lesson_feedback','coaching_assignment','coaching_progress','round_comment'));
commit;
