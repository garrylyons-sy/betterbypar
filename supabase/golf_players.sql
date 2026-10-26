begin;
-- Registration is separate from login, guardian relationships and club access.
alter table public.person add column if not exists is_golf_player boolean not null default false;
alter table public.person add column if not exists golf_ireland_number text;
alter table public.person drop constraint if exists person_golf_ireland_number_format;
alter table public.person add constraint person_golf_ireland_number_format check(golf_ireland_number is null or golf_ireland_number ~ '^[0-9]{1,20}$');
alter table public.person drop constraint if exists person_player_registration;
alter table public.person add constraint person_player_registration check(not is_golf_player or golf_ireland_number is not null);
create unique index if not exists person_golf_ireland_number_unique on public.person(golf_ireland_number) where golf_ireland_number is not null;

create or replace function public.is_golf_coach(player_id uuid) returns boolean language sql stable as $$
 select exists(select 1 from public.club_membership where person_id=player_id and active and role in ('Golf Professional','Assistant Professional'));
$$;
create or replace function public.is_golf_player(player_id uuid,at_club uuid) returns boolean language sql stable as $$
 select exists(select 1 from public.person p where p.id=player_id and p.active and p.is_golf_player and p.golf_ireland_number is not null
 and not public.is_golf_coach(p.id) and exists(select 1 from public.club_membership cm join public.club c on c.id=cm.club_id and c.active where cm.person_id=p.id and cm.club_id=at_club and cm.active));
$$;

create or replace function public.check_golf_player_registration() returns trigger language plpgsql as $$
begin
 if new.is_golf_player and public.is_golf_coach(new.id) then raise exception 'Professionals and assistants cannot be registered as players.'; end if;
 if tg_op='UPDATE' and old.is_golf_player and not new.is_golf_player then
  update public.team_membership set active=false where person_id=new.id and role='Player' and active;
  update public.person_team_role set active=false where person_id=new.id and role='Player' and active;
  update public.lesson_group_member set active=false where person_id=new.id and active;
  update public.dependants set active=false,updated_at=now() where dependant_person_id=new.id and active;
  update public.lesson_booking b set status='Cancelled',cancelled_at=now() from public.lesson_slot s where b.slot_id=s.id and b.player_person_id=new.id and b.status='Booked' and s.starts_at>now();
  delete from public.lesson_reminder where booking_id in(select id from public.lesson_booking where player_person_id=new.id and status='Cancelled');
 end if;
 return new;
end $$;
drop trigger if exists person_golf_registration on public.person;
create trigger person_golf_registration before insert or update of is_golf_player,golf_ireland_number on public.person for each row execute function public.check_golf_player_registration();

create or replace function public.remove_coach_player_roles() returns trigger language plpgsql as $$
begin
 if new.active and new.role in ('Golf Professional','Assistant Professional') then
  update public.person set is_golf_player=false where id=new.person_id;
  update public.team_membership set active=false where person_id=new.person_id and role='Player' and active;
  update public.person_team_role set active=false where person_id=new.person_id and role='Player' and active;
  update public.lesson_group_member set active=false where person_id=new.person_id and active;
  update public.dependants set active=false,updated_at=now() where dependant_person_id=new.person_id and active;
  update public.lesson_booking b set status='Cancelled',cancelled_at=now() from public.lesson_slot s where b.slot_id=s.id and b.player_person_id=new.person_id and b.status='Booked' and s.starts_at>now();
  delete from public.lesson_reminder where booking_id in(select id from public.lesson_booking where player_person_id=new.person_id and status='Cancelled');
 end if;
 return new;
end $$;
drop trigger if exists club_coach_not_player on public.club_membership;
create trigger club_coach_not_player before insert or update of active,role on public.club_membership for each row execute function public.remove_coach_player_roles();
-- Correct any inherited player roles on coaching staff without removing club access.
update public.person set is_golf_player=false where public.is_golf_coach(id);
update public.team_membership set active=false where role='Player' and active and public.is_golf_coach(person_id);
update public.person_team_role set active=false where role='Player' and active and public.is_golf_coach(person_id);
update public.lesson_group_member set active=false where active and public.is_golf_coach(person_id);
update public.dependants set active=false,updated_at=now() where active and public.is_golf_coach(dependant_person_id);
update public.lesson_booking b set status='Cancelled',cancelled_at=now() from public.lesson_slot s where b.slot_id=s.id and b.status='Booked' and s.starts_at>now() and public.is_golf_coach(b.player_person_id);
delete from public.lesson_reminder where booking_id in(select id from public.lesson_booking where status='Cancelled' and public.is_golf_coach(player_person_id));

create or replace function public.check_golf_team_player() returns trigger language plpgsql as $$
begin
 if new.active and new.role='Player' and (public.is_golf_coach(new.person_id) or not exists(select 1 from public.person where id=new.person_id and is_golf_player and golf_ireland_number is not null)) then
  raise exception 'Player registration with a Golf Ireland number is required. Professionals and assistants cannot have player roles.';
 end if;
 return new;
end $$;
drop trigger if exists team_golf_player on public.team_membership;
create trigger team_golf_player before insert or update on public.team_membership for each row execute function public.check_golf_team_player();
drop trigger if exists person_team_golf_player on public.person_team_role;
create trigger person_team_golf_player before insert or update on public.person_team_role for each row execute function public.check_golf_team_player();

create or replace function public.check_lesson_registered_player() returns trigger language plpgsql as $$
declare at_club uuid;
begin
 if new.status='Booked' then
  if tg_op='UPDATE' and old.status='Booked' and new.player_person_id=old.player_person_id and new.slot_id=old.slot_id then return new; end if;
  select club_id into at_club from public.lesson_slot where id=new.slot_id;
  if not public.is_golf_player(new.player_person_id,at_club) then raise exception 'Choose a registered player with a Golf Ireland number. Professionals and assistants cannot attend as players.'; end if;
 end if;
 return new;
end $$;
drop trigger if exists lesson_registered_player on public.lesson_booking;
create trigger lesson_registered_player before insert or update of slot_id,player_person_id,status on public.lesson_booking for each row execute function public.check_lesson_registered_player();
create or replace function public.check_group_registered_player() returns trigger language plpgsql as $$
declare at_club uuid;
begin
 if new.active then
  select club_id into at_club from public.lesson_group where id=new.group_id;
  if not public.is_golf_player(new.person_id,at_club) then raise exception 'Choose a registered player with a Golf Ireland number for the group.'; end if;
 end if;
 return new;
end $$;
drop trigger if exists group_registered_player on public.lesson_group_member;
create trigger group_registered_player before insert or update on public.lesson_group_member for each row execute function public.check_group_registered_player();

commit;
