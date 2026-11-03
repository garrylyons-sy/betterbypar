begin;
alter table public.person add column if not exists player_club_id uuid references public.club(id);
-- Preserve historical memberships; only the home club confers player eligibility.
update public.person p set player_club_id=(select cm.club_id from public.club_membership cm join public.club c on c.id=cm.club_id and c.active
 where cm.person_id=p.id and cm.active order by (select count(*) from public.lesson_booking b join public.lesson_slot s on s.id=b.slot_id where b.player_person_id=p.id and s.club_id=cm.club_id) desc,c.name,cm.club_id limit 1)
 where p.is_golf_player and p.player_club_id is null;
-- Retire duplicate player-only access without touching separate club administration.
update public.club_membership cm set active=false from public.person p where cm.person_id=p.id and p.is_golf_player and p.player_club_id is not null and cm.club_id<>p.player_club_id and cm.active and cm.role in ('Club Member','Player') and not cm.is_club_admin and not exists(select 1 from public.club_admin ca where ca.person_id=p.id and ca.club_id=cm.club_id and ca.active);
update public.person_team_role ptr set active=false from public.person p where ptr.person_id=p.id and p.is_golf_player and p.player_club_id is not null and ptr.club_id<>p.player_club_id and ptr.role='Player' and ptr.active;
update public.team_membership tm set active=false from public.person p,public.team t where tm.person_id=p.id and tm.team_id=t.id and p.is_golf_player and p.player_club_id is not null and t.club_id<>p.player_club_id and tm.role='Player' and tm.active;
create or replace function public.is_golf_player(player_id uuid,at_club uuid) returns boolean language sql stable as $$
 select exists(select 1 from public.person p where p.id=player_id and p.active and p.is_golf_player and p.golf_ireland_number is not null
 and p.player_club_id=at_club and not public.is_golf_coach(p.id) and exists(select 1 from public.club_membership cm join public.club c on c.id=cm.club_id and c.active where cm.person_id=p.id and cm.club_id=at_club and cm.active));
$$;
create or replace function public.assign_player_home_club() returns trigger language plpgsql set search_path=public as $$
declare home uuid; registered boolean;
begin
 if not new.active or new.role not in ('Club Member','Player') then return new; end if;
 select player_club_id,is_golf_player into home,registered from person where id=new.person_id for update;
 if registered then
  if home is null then update person set player_club_id=new.club_id where id=new.person_id;
  elsif home<>new.club_id and not new.is_club_admin and not exists(select 1 from club_admin where person_id=new.person_id and club_id=new.club_id and active) then
   raise exception 'A player can have only one home club. Use their existing club or change their home club in administration.';
  end if;
 end if;return new;
end $$;
drop trigger if exists player_single_home_club on public.club_membership;
create trigger player_single_home_club before insert or update of active,club_id,person_id,role on public.club_membership for each row execute function public.assign_player_home_club();
create or replace function public.default_player_home_club() returns trigger language plpgsql set search_path=public as $$
begin
 if new.is_golf_player and new.player_club_id is null then
  select cm.club_id into new.player_club_id from club_membership cm join club c on c.id=cm.club_id and c.active where cm.person_id=new.id and cm.active order by c.name,cm.club_id limit 1;
 end if;
 return new;
end $$;
drop trigger if exists person_default_home_club on public.person;
create trigger person_default_home_club before insert or update of is_golf_player,player_club_id on public.person for each row execute function public.default_player_home_club();

create table if not exists public.lesson_location(
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.club(id),name text not null check(length(trim(name)) between 1 and 80),
 active boolean not null default true,sort_order integer not null default 0,created_at timestamptz not null default now(),unique(id,club_id)
);
create unique index if not exists lesson_location_club_name on public.lesson_location(club_id,lower(name));
alter table public.lesson_slot add column if not exists location_id uuid;
do $$ begin if not exists(select 1 from pg_constraint where conname='lesson_slot_location_club') then
 alter table public.lesson_slot add constraint lesson_slot_location_club foreign key(location_id,club_id) references public.lesson_location(id,club_id);
end if;end $$;
insert into public.lesson_location(club_id,name,sort_order)
 select c.id,l.name,l.position from public.club c cross join(values('Trackman',0),('Range',1),('Playing',2),('Valley',3)) l(name,position)
 where (lower(c.name) in ('castle','castle golf club') or (lower(c.name) in ('grange','grange golf club') and l.name<>'Valley'))
 on conflict do nothing;
alter table public.lesson_location enable row level security;
revoke all on public.lesson_location from public,anon,authenticated;
commit;
