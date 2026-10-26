import {notifyLessonEvent} from '@/lib/server/lesson-notifications';
import {scheduleNotificationPush} from '@/lib/server/notification-dispatch';
import { NextResponse } from 'next/server';
import { dbQuery,withTransaction } from '@/lib/server/db';
import { golfAccess,golfError,requireLessonsManager,golfAudit,AccessError } from '@/lib/server/golf-access';
import { normalizeLessonSlot } from '@/lib/golf-policy';
import {requireDiaryOwner} from '@/lib/server/lesson-diary';
export const runtime='nodejs';
export async function GET(request:Request) {
 try {
  const a=await golfAccess(request);
  const scope=[...new Set([...a.adminClubIds,...a.assignments.filter(r=>['Golf Professional','Assistant Professional'].includes(r.role)).map(r=>r.clubId)])];
  if(!a.platform&&!scope.length) throw new AccessError('Professional or administrator access required.');
  const [clubs,people,slots]=await Promise.all([
   dbQuery(`select id,name from public.club where active and ($1::boolean or id=any($2::uuid[])) order by name`,[a.platform,scope]),
   dbQuery(`select distinct p.id,concat_ws(' ',p.first_name,p.last_name) as name,cm.club_id,cm.role from public.club_membership cm
    join public.person p on p.id=cm.person_id and p.active join public.club c on c.id=cm.club_id and c.active
    where cm.active and ($1::boolean or cm.club_id=any($2::uuid[])) order by name`,[a.platform,scope]),
   dbQuery(`select s.*,c.name as club_name,concat_ws(' ',p.first_name,p.last_name) as professional_name,b.id as booking_id,b.player_person_id,
    concat_ws(' ',player.first_name,player.last_name) as player_name,concat_ws(' ',actor.first_name,actor.last_name) as booked_by_name
    from public.lesson_slot s join public.club c on c.id=s.club_id join public.person p on p.id=s.professional_person_id
    left join public.lesson_booking b on b.slot_id=s.id and b.status='Booked' and s.group_id is null left join public.person player on player.id=b.player_person_id
    left join public.person actor on actor.id=b.booked_by where ($1::boolean or s.club_id=any($2::uuid[])) and s.ends_at>now()-interval '30 days' and ($1::boolean or s.club_id=any($3::uuid[]) or s.professional_person_id=$4)
    order by s.starts_at`,[a.platform,scope,a.adminClubIds,a.user.personId])
  ]);
  return NextResponse.json({clubs:clubs.rows,people:people.rows,slots:slots.rows});
 } catch(error) {const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
export async function POST(request:Request) {
 try {
  const a=await golfAccess(request),input=normalizeLessonSlot(await request.json());requireDiaryOwner(a,input.clubId,input.professionalId);
  if(new Date(input.endsAt).getTime()-new Date(input.startsAt).getTime()!==1800000)throw new Error('Lessons must be 30 minutes.');
  if(new Date(input.startsAt).getUTCMinutes()%30!==0||new Date(input.startsAt).getUTCSeconds()!==0)throw new Error('Use the 30-minute grid.');
  const slot=await withTransaction(async client=>{
   const professional=await client.query(`select cm.id from public.club_membership cm join public.person p on p.id=cm.person_id and p.active
    join public.club c on c.id=cm.club_id and c.active where cm.club_id=$1 and cm.person_id=$2 and cm.active and cm.role in ('Golf Professional','Assistant Professional') for share of cm,p,c`,[input.clubId,input.professionalId]);
   if(!professional.rowCount) throw new Error('Select an active professional at this club.');
   const result=await client.query(`insert into public.lesson_slot(club_id,professional_person_id,title,starts_at,ends_at,created_by)
    values($1,$2,$3,$4,$5,$6) returning *`,[input.clubId,input.professionalId,input.title,input.startsAt,input.endsAt,a.user.personId]);
   await golfAudit(client,a.user.personId,'Lesson slot published',{slotId:result.rows[0].id,...input});return result.rows[0];
  });return NextResponse.json({slot},{status:201});
 } catch(error) {const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
export async function PATCH(request:Request) {
 try {
  const a=await golfAccess(request),b=await request.json();
  await withTransaction(async client=>{
   const slot=await client.query('select * from public.lesson_slot where id=$1 for update',[String(b.id??'')]);
   if(!slot.rowCount) throw new Error('Lesson not found.');requireDiaryOwner(a,slot.rows[0].club_id,slot.rows[0].professional_person_id);
   if(slot.rows[0].diary_managed)throw new Error('Change this week’s hours to remove an available diary time. Cancel any booking first.');
   const cancelled=await client.query(`update public.lesson_booking set status='Cancelled',cancelled_at=now(),cancelled_by=$2 where slot_id=$1 and status='Booked' returning id`,[b.id,a.user.personId]);
   for(const booking of cancelled.rows){
    await client.query('delete from lesson_reminder where booking_id=$1',[booking.id]);
    await notifyLessonEvent(client,booking.id,'lesson_cancelled',a.user.personId);
   }
   await client.query('update public.lesson_slot set active=false where id=$1',[b.id]);
   await golfAudit(client,a.user.personId,'Lesson slot cancelled',{slotId:b.id});
  });scheduleNotificationPush();return NextResponse.json({ok:true});
 } catch(error) {const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
