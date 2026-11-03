import {coachingStatistics} from '@/lib/server/coaching-statistics';
import {NextResponse} from 'next/server';
import {withTransaction} from '@/lib/server/db';
import {golfAccess,golfError,AccessError} from '@/lib/server/golf-access';
import {materializeLessons,requireActiveCoach,requireCoachBookingAccess} from '@/lib/server/lesson-diary';
import {weekStart,addDays,dublinDate} from '@/lib/lesson-diary.mjs';
import {isProfessional} from '@/shared/golf-capabilities.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const access=await golfAccess(request),params=new URL(request.url).searchParams;
 const memberships=access.assignments.filter(a=>isProfessional([a.role]));
 const clubId=params.get('clubId')||memberships[0]?.clubId;
 if(!clubId||!memberships.some(a=>a.clubId===clubId))throw new AccessError('Active professional access for this club is required.');
 const week=weekStart(params.get('week')||dublinDate()),current=weekStart();
 if(week<addDays(current,-364)||week>addDays(current,49))throw new AccessError('Choose a week within the coaching diary range.',400);
 await materializeLessons([clubId],access.user.personId);
 const overview=await withTransaction(async client=>{
  await requireActiveCoach(client,clubId,access.user.personId);
  const professionalId=params.get('professionalId')||access.user.personId;
  await requireCoachBookingAccess(client,access,clubId,professionalId);
  const professionals=(await client.query(`select distinct p.id,concat_ws(' ',p.first_name,p.last_name) as name,cm.role from club_membership cm join person p on p.id=cm.person_id and p.active where cm.club_id=$1 and cm.active and (p.id=$2 or ($3::boolean and cm.role='Assistant Professional')) and cm.role in ('Golf Professional','Assistant Professional') order by cm.role desc,name`,[clubId,access.user.personId,memberships.some(a=>a.clubId===clubId&&a.role==='Golf Professional')])).rows;
  const professional=professionals.find(p=>p.id===professionalId);if(!professional)throw new AccessError('Choose your own diary or an active assistant.');
  const club=(await client.query('select id,name from club where id=$1 and active',[clubId])).rows[0];if(!club)throw new AccessError('Club unavailable.');
  const players=(await client.query(`select p.id,concat_ws(' ',p.first_name,p.last_name) as name,p.golf_ireland_number as "golfIrelandNumber",exists(select 1 from user_account where person_id=p.id and active) as "onPlatform",
   (select count(*)::int from lesson_booking b join lesson_slot s on s.id=b.slot_id where b.player_person_id=p.id and s.club_id=$1 and s.active and b.status='Booked' and s.ends_at<=now()) as "lessonCount",
   (select count(*)::int from lesson_booking b join lesson_slot s on s.id=b.slot_id where b.player_person_id=p.id and s.club_id=$1 and s.active and b.status='Booked' and s.ends_at>now()) as "upcomingLessonCount" from person p where public.is_golf_player(p.id,$1) order by p.first_name,p.last_name,p.id`,[clubId])).rows;
  const groups=(await client.query(`select g.id,g.name,g.mode,g.capacity,coalesce((select jsonb_agg(gm.person_id order by gm.person_id) from lesson_group_member gm where gm.group_id=g.id and gm.active and public.is_golf_player(gm.person_id,g.club_id)),'[]'::jsonb) as "memberIds" from lesson_group g where g.club_id=$1 and g.active order by g.name`,[clubId])).rows;
  const slots=(await client.query(`select s.id,s.title,s.location_id as "locationId",(select name from lesson_location where id=s.location_id) as "locationName",s.starts_at as "startsAt",s.ends_at as "endsAt",s.group_id as "groupId",g.name as "groupName",s.capacity,coalesce(part.count,0)::int as "bookedCount",coalesce(part.items,'[]'::jsonb) as bookings from lesson_slot s left join lesson_group g on g.id=s.group_id left join lateral(select count(*) as count,jsonb_agg(jsonb_build_object('id',b.id,'playerId',b.player_person_id,'playerName',concat_ws(' ',p.first_name,p.last_name),'goals',b.goals,'feedback',b.feedback,'drills',b.drills) order by p.first_name,p.last_name) as items from lesson_booking b join person p on p.id=b.player_person_id where b.slot_id=s.id and b.status='Booked' and public.is_golf_player(p.id,s.club_id)) part on true where s.club_id=$1 and s.professional_person_id=$2 and s.active and (s.starts_at at time zone 'Europe/Dublin')::date>=$3::date and (s.starts_at at time zone 'Europe/Dublin')::date<$3::date+7 order by s.starts_at`,[clubId,professionalId,week])).rows;
  const statistics=await coachingStatistics(client,clubId,access.user.personId,memberships.some(a=>a.clubId===clubId&&a.role==='Golf Professional'));
  const locations=(await client.query('select id,name from lesson_location where club_id=$1 and active order by sort_order,name',[clubId])).rows;
  return {professionals,canEditDiary:professionalId===access.user.personId,canBookForMember:true,statistics,locations,actorId:access.user.personId,club,professional,week,players,groups,slots};
 });return NextResponse.json(overview,{headers:{'Cache-Control':'no-store'}});
 }catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status,headers:{'Cache-Control':'no-store'}});}}
