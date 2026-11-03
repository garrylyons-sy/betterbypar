-- Groups belong to a club; the assigned coach belongs to each session.
begin;
create or replace function public.golf_validate_booking() returns trigger language plpgsql set search_path=public as $$
declare slot public.lesson_slot; grp public.lesson_group;
begin
 if new.status='Cancelled' then return new; end if;
 if tg_op='UPDATE' and new.slot_id=old.slot_id and new.player_person_id=old.player_person_id and new.booked_by=old.booked_by and new.starts_at=old.starts_at and new.ends_at=old.ends_at and old.status='Booked' then return new; end if;
 select * into slot from public.lesson_slot where id=new.slot_id for update;
 if not found or not slot.active or slot.starts_at<=now() then raise exception 'This lesson is no longer available.'; end if;
 if not exists(select 1 from public.club c where c.id=slot.club_id and c.active) then raise exception 'Club is inactive.'; end if;
 if not exists(select 1 from public.club_membership cm join public.person p on p.id=cm.person_id and p.active where cm.club_id=slot.club_id and cm.person_id=new.player_person_id and cm.active) then raise exception 'Player needs active club membership.'; end if;
 if not exists(select 1 from public.club_membership cm join public.person p on p.id=cm.person_id and p.active where cm.club_id=slot.club_id and cm.person_id=slot.professional_person_id and cm.active and cm.role in ('Golf Professional','Assistant Professional')) then raise exception 'Professional is no longer active at this club.'; end if;
 if slot.group_id is not null then
  select * into grp from public.lesson_group where id=slot.group_id;
  if not found or not grp.active or grp.club_id<>slot.club_id then raise exception 'This coaching group is unavailable.'; end if;
  if grp.mode='Roster' then
   perform 1 from public.lesson_group_member where group_id=grp.id and person_id=new.player_person_id and active for share;
   if not found then raise exception 'This player is not on the group roster.'; end if;
  end if;
 end if;
 if slot.capacity is not null and (select count(*) from public.lesson_booking where slot_id=slot.id and status='Booked' and id<>new.id)>=slot.capacity then raise exception 'No places remain in this lesson.'; end if;
 new.starts_at=slot.starts_at;new.ends_at=slot.ends_at;return new;
end $$;
commit;
