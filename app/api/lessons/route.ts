import {notifyLessonEvent} from '@/lib/server/lesson-notifications';
import {scheduleNotificationPush} from '@/lib/server/notification-dispatch';
import { NextResponse } from 'next/server';
import { dbQuery,withTransaction } from '@/lib/server/db';
import { golfAccess,golfError,requirePlayerAccess,golfAudit } from '@/lib/server/golf-access';
import {materializeLessons,queueLessonReminder,requireDiaryOwner} from '@/lib/server/lesson-diary';
import {lessonText,reminderMinutes} from '@/lib/lesson-diary.mjs';
export const runtime='nodejs';
export async function GET(request:Request) {
 try {
  const a=await golfAccess(request);
  const scope=[...new Set(a.assignments.map(r=>r.clubId))];
  await materializeLessons(scope,a.user.personId);
  const [slots,players,bookings]=await Promise.all([
   dbQuery(`select s.id,s.club_id,s.title,s.starts_at,s.ends_at,s.professional_person_id,s.group_id,s.capacity,g.name as group_name,g.mode as group_mode,
    (select count(*)::int from lesson_booking where slot_id=s.id and status='Booked') as booked_count,eligible.player_ids as eligible_player_ids,
    case when c.show_lesson_attendee_names then coalesce((select jsonb_agg(concat_ws(' ',attendee.first_name,attendee.last_name) order by attendee.last_name,attendee.first_name)
     from lesson_booking attendance join person attendee on attendee.id=attendance.player_person_id and attendee.active
     where attendance.slot_id=s.id and attendance.status='Booked' and public.is_golf_player(attendee.id,s.club_id)), '[]'::jsonb) else '[]'::jsonb end as attendee_names,
    (select role from club_membership where club_id=s.club_id and person_id=s.professional_person_id and active and role in ('Golf Professional','Assistant Professional') order by role desc limit 1) as professional_role,c.name as club_name,concat_ws(' ',p.first_name,p.last_name) as professional_name,
    (s.capacity is not null and (select count(*) from lesson_booking where slot_id=s.id and status='Booked')>=s.capacity) as booked
    from public.lesson_slot s left join lesson_group g on g.id=s.group_id
    left join lateral (select coalesce(array_agg(distinct gm.person_id),array[]::uuid[]) as player_ids from lesson_group_member gm
     join person gp on gp.id=gm.person_id and gp.active where gm.group_id=s.group_id and gm.active and public.is_golf_player(gp.id,s.club_id)
     and exists(select 1 from club_membership where club_id=s.club_id and person_id=gp.id and active)
     and (gm.person_id=$2 or exists(select 1 from dependants where guardian_person_id=$2 and dependant_person_id=gm.person_id and club_id=s.club_id and active))) eligible on true
    join public.club c on c.id=s.club_id and c.active join public.person p on p.id=s.professional_person_id and p.active
    where s.active and (s.group_id is not null or s.ends_at=s.starts_at+interval '30 minutes') and s.starts_at>now()
    and (s.group_id is null or (g.active and (g.mode='Open' or cardinality(eligible.player_ids)>0))) and s.club_id=any($1::uuid[])
    and exists(select 1 from public.club_membership cm where cm.person_id=p.id and cm.club_id=s.club_id and cm.active and cm.role in ('Golf Professional','Assistant Professional')) order by s.starts_at`,[scope,a.user.personId]),
   dbQuery(`select distinct p.id,concat_ws(' ',p.first_name,p.last_name) as name,cm.club_id from public.club_membership cm join public.person p on p.id=cm.person_id and p.active
    where cm.active and public.is_golf_player(p.id,cm.club_id) and cm.club_id=any($2::uuid[]) and (p.id=$1 or exists(select 1 from public.dependants d where d.guardian_person_id=$1 and d.dependant_person_id=p.id and d.club_id=cm.club_id and d.active)) order by name`,[a.user.personId,scope]),
   dbQuery(`select b.id,b.slot_id,b.player_person_id,s.group_id,g.name as group_name,b.goals,b.reminder_minutes,b.feedback,b.drills,
    (b.status='Booked' and b.reminder_minutes>0 and s.starts_at>now() and s.starts_at<=now()+b.reminder_minutes*interval '1 minute') as reminder_due,s.club_id,s.title,s.starts_at,s.ends_at,s.active,b.status,c.name as club_name,concat_ws(' ',p.first_name,p.last_name) as player_name,
    concat_ws(' ',pro.first_name,pro.last_name) as professional_name from public.lesson_booking b join public.lesson_slot s on s.id=b.slot_id left join lesson_group g on g.id=s.group_id join public.club c on c.id=s.club_id and c.active
    join public.person p on p.id=b.player_person_id and p.active join public.person pro on pro.id=s.professional_person_id
    where s.club_id=any($2::uuid[]) and exists(select 1 from public.club_membership pcm where pcm.club_id=s.club_id and pcm.person_id=b.player_person_id and pcm.active) and s.ends_at>now()-interval '365 days' and (b.player_person_id=$1 or exists(select 1 from public.dependants d where d.guardian_person_id=$1 and d.dependant_person_id=b.player_person_id and d.club_id=s.club_id and d.active)) order by s.starts_at`,[a.user.personId,scope])
  ]);
  const canManage=a.platform||a.adminClubIds.length>0||a.assignments.some(r=>['Golf Professional','Assistant Professional'].includes(r.role));
  return NextResponse.json({slots:slots.rows,players:players.rows,bookings:bookings.rows,canManage,actorId:a.user.personId,reminderEmailReady:Boolean(process.env.RESEND_API_KEY&&(process.env.INVITE_FROM_EMAIL||process.env.EMAIL_FROM))});
 } catch(error) {const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
export async function POST(request:Request) {
 try {
  const a=await golfAccess(request),b=await request.json();
  const goals=lessonText(b.goals,2000,'Lesson goals'),reminder=reminderMinutes(b.reminderMinutes);
  const booking=await withTransaction(async client=>{
   const slot=await client.query('select * from public.lesson_slot where id=$1 for update',[String(b.slotId??'')]);
   if(!slot.rowCount) throw new Error('Lesson not found.');
   if(!slot.rows[0].group_id&&new Date(slot.rows[0].ends_at).getTime()-new Date(slot.rows[0].starts_at).getTime()!==1800000)throw new Error('Choose a 30-minute lesson.');
   const playerId=String(b.playerId??a.user.personId);
   await requirePlayerAccess(client,a.user.personId,playerId,slot.rows[0].club_id);
   const result=await client.query(`insert into public.lesson_booking(slot_id,player_person_id,booked_by,starts_at,ends_at,goals,reminder_minutes) values($1,$2,$3,$4,$5,$6,$7) returning id`,[slot.rows[0].id,playerId,a.user.personId,slot.rows[0].starts_at,slot.rows[0].ends_at,goals,reminder]);
   await queueLessonReminder(client,result.rows[0].id);
   await notifyLessonEvent(client,result.rows[0].id,'lesson_booking',a.user.personId);
   await golfAudit(client,a.user.personId,'Lesson booked',{bookingId:result.rows[0].id,slotId:b.slotId,playerId});return result.rows[0];
  });scheduleNotificationPush();return NextResponse.json({booking},{status:201});
 } catch(error) {const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
export async function PATCH(request:Request) {
 try {
  const a=await golfAccess(request),b=await request.json();
  await withTransaction(async client=>{
   // Lock slot before booking in the same order as booking/slot cancellation.
   const found=await client.query('select slot_id from public.lesson_booking where id=$1',[String(b.id??'')]);
   if(!found.rowCount) throw new Error('Booking not found.');
   const slots=await client.query('select * from public.lesson_slot where id=$1 for update',[found.rows[0].slot_id]);
   const result=await client.query('select * from public.lesson_booking where id=$1 for update',[b.id]);
   const booking=result.rows[0],slot=slots.rows[0];
   if(slot.starts_at<=new Date()) throw new Error('Past lessons cannot be cancelled.');
   if(b.asManager===true) requireDiaryOwner(a,slot.club_id,slot.professional_person_id);
   else await requirePlayerAccess(client,a.user.personId,booking.player_person_id,slot.club_id);
   if(b.action==='reminder'){
    await requirePlayerAccess(client,a.user.personId,booking.player_person_id,slot.club_id);
    if(booking.status!=='Booked')throw new Error('This booking is cancelled.');
    await client.query('update lesson_booking set reminder_minutes=$2,reminder_person_id=$3 where id=$1',[b.id,reminderMinutes(b.reminderMinutes),a.user.personId]);
    await queueLessonReminder(client,b.id);return;
   }
   await client.query(`update public.lesson_booking set status='Cancelled',cancelled_at=now(),cancelled_by=$2 where id=$1`,[b.id,a.user.personId]);
   await client.query('delete from lesson_reminder where booking_id=$1',[b.id]);
   await notifyLessonEvent(client,b.id,'lesson_cancelled',a.user.personId);
   await golfAudit(client,a.user.personId,'Lesson booking cancelled',{bookingId:b.id});
  });scheduleNotificationPush();return NextResponse.json({ok:true});
 } catch(error) {const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
