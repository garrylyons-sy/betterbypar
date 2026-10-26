import type {PoolClient} from 'pg';
import {AccessError,golfAudit,requireLessonsManager,type GolfAccess} from '@/lib/server/golf-access';
import {requireActiveCoach,queueLessonReminder} from '@/lib/server/lesson-diary';
import {notifyLessonEvent} from '@/lib/server/lesson-notifications';
export async function bookLessonForMember(client:PoolClient,a:GolfAccess,slotId:string,playerId:string,goals:string,reminder:number){
   const found=await client.query('select * from lesson_slot where id=$1 for update',[slotId]);
   const slot=found.rows[0];if(!slot)throw new Error('Lesson not found.');
   if(slot.professional_person_id!==a.user.personId)throw new AccessError('Only the appointed lesson professional can book for a member.');
   requireLessonsManager(a,slot.club_id);
   await requireActiveCoach(client,slot.club_id,a.user.personId);
   if(!slot.group_id&&new Date(slot.ends_at).getTime()-new Date(slot.starts_at).getTime()!==1800000)throw new Error('Choose a 30-minute lesson.');
   const player=await client.query(`select p.id,concat_ws(' ',p.first_name,p.last_name) as name from club_membership cm join person p on p.id=cm.person_id and p.active
    where cm.club_id=$1 and cm.person_id=$2 and cm.active and public.is_golf_player(p.id,cm.club_id) for share of cm,p`,[slot.club_id,playerId]);
   if(!player.rowCount)throw new AccessError('Select an active member of this lesson’s club.');
   const recipients=await client.query(`select distinct p.id from person p join user_account ua on ua.person_id=p.id and ua.active
    join club_membership cm on cm.person_id=p.id and cm.club_id=$1 and cm.active
    where p.active and (p.id=$2 or exists(select 1 from dependants d where d.guardian_person_id=p.id and d.dependant_person_id=$2 and d.club_id=$1 and d.active)) order by p.id`,[slot.club_id,playerId]);
   // Prefer the player's account for reminders; account-free juniors use an active guardian.
   const reminderId=recipients.rows.find(r=>r.id===playerId)?.id??recipients.rows[0]?.id??null;
   const booked=await client.query(`insert into lesson_booking(slot_id,player_person_id,booked_by,starts_at,ends_at,goals,reminder_minutes,reminder_person_id)
    values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,[slot.id,playerId,a.user.personId,slot.starts_at,slot.ends_at,goals,reminderId?reminder:0,reminderId]);
   const booking=booked.rows[0];await queueLessonReminder(client,booking.id);
   const notified=await notifyLessonEvent(client,booking.id,'lesson_booking',a.user.personId);
   await golfAudit(client,a.user.personId,'Lesson booked for member',{bookingId:booking.id,playerId,slotId:slot.id});
   return {booking,notified};
}
