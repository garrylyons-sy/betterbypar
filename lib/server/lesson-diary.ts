import type {PoolClient} from 'pg';
import {withTransaction} from '@/lib/server/db';
import {AccessError,requireLessonsManager,type GolfAccess} from '@/lib/server/golf-access';
import {weekStart,dublinDate,addDays} from '@/lib/lesson-diary.mjs';
export function requireDiaryOwner(a:GolfAccess,clubId:string,professionalId:string){
 requireLessonsManager(a,clubId);
 if(!a.platform&&!a.adminClubIds.includes(clubId)&&a.user.personId!==professionalId)throw new AccessError('You can only change your own lesson diary.');
}
/** Booking an assistant is separate from ownership of their hours and coaching notes. */
export async function requireCoachBookingAccess(client:PoolClient,a:GolfAccess,clubId:string,professionalId:string){
 requireLessonsManager(a,clubId);
 await requireActiveCoach(client,clubId,a.user.personId);
 if(a.user.personId===professionalId)return;
 if(!a.assignments.some(grant=>grant.clubId===clubId&&grant.role==='Golf Professional'))throw new AccessError('Only a professional can book lessons for an assistant at their club.');
 await requireActiveCoach(client,clubId,professionalId);
 const roles=await client.query(`select cm.person_id,cm.role from club_membership cm where cm.club_id=$1 and cm.person_id=any($2::uuid[]) and cm.active for share of cm`,[clubId,[a.user.personId,professionalId]]);
 if(!roles.rows.some(row=>row.person_id===a.user.personId&&row.role==='Golf Professional')||!roles.rows.some(row=>row.person_id===professionalId&&row.role==='Assistant Professional'))throw new AccessError('Choose your own diary or an active assistant at this club.');
}
export async function requireActiveCoach(client:PoolClient,clubId:string,professionalId:string){
 const result=await client.query(`select cm.id from club_membership cm join person p on p.id=cm.person_id and p.active join club c on c.id=cm.club_id and c.active
 where cm.club_id=$1 and cm.person_id=$2 and cm.active and cm.role in ('Golf Professional','Assistant Professional') for share of cm,p,c`,[clubId,professionalId]);
 if(!result.rowCount)throw new Error('Select an active professional at this club.');
}
export async function materializeLessons(clubIds:string[],actorId:string){
 if(!clubIds.length)return;
 const first=weekStart(dublinDate()),last=addDays(first,55);
 await withTransaction(async client=>{
  const coaches=await client.query(`select distinct club_id,professional_person_id from (
   select club_id,professional_person_id from lesson_default_week union select club_id,professional_person_id from lesson_week_override
  ) diaries where club_id=any($1::uuid[]) order by professional_person_id,club_id`,[clubIds]);
  for(const coach of coaches.rows)await client.query('select lesson_sync($1,$2,$3,$4,$5,false)',[coach.club_id,coach.professional_person_id,first,last,actorId]);
 });
}
export async function queueLessonReminder(client:PoolClient,bookingId:string){
 await client.query(`insert into lesson_reminder(booking_id,available_at)
 select id,greatest(now(),starts_at-reminder_minutes*interval '1 minute') from lesson_booking where id=$1 and status='Booked' and reminder_minutes>0
 on conflict(booking_id) do update set available_at=excluded.available_at,sent_at=null,attempts=0,last_error=null,locked_until=null,revision=gen_random_uuid()`,[bookingId]);
 await client.query(`delete from lesson_reminder where booking_id=$1 and not exists(select 1 from lesson_booking where id=$1 and status='Booked' and reminder_minutes>0)`,[bookingId]);
}
