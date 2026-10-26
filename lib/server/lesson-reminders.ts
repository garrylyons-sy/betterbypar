import {withTransaction} from '@/lib/server/db';
import {createNotification} from '@/lib/server/notifications';
import {notificationEmailReady} from '@/lib/server/notification-email';
import {scheduleNotificationPush} from '@/lib/server/notification-dispatch';
export const lessonReminderEmailReady=notificationEmailReady;
// This worker publishes reminder events; the shared outboxes choose and deliver channels.
export async function processLessonReminders(){
 const stats={published:0,skipped:0,emailReady:notificationEmailReady()};
 await withTransaction(async client=>{
  const jobs=await client.query(`select r.booking_id,r.revision,b.player_person_id,s.club_id,s.starts_at,s.ends_at,
   coalesce(g.name,s.title) as title,c.name as club_name,concat_ws(' ',player.first_name,player.last_name) as player_name,
   concat_ws(' ',pro.first_name,pro.last_name) as professional_name
   from lesson_reminder r join lesson_booking b on b.id=r.booking_id and b.status='Booked' and b.reminder_minutes>0
   join lesson_slot s on s.id=b.slot_id and s.active and s.starts_at>now()
   left join lesson_group g on g.id=s.group_id join club c on c.id=s.club_id and c.active
   join person player on player.id=b.player_person_id and player.active join person pro on pro.id=s.professional_person_id and pro.active
   where r.sent_at is null and r.available_at<=now() and public.is_golf_player(player.id,s.club_id)
   and exists(select 1 from club_membership where club_id=s.club_id and person_id=pro.id and active and role in ('Golf Professional','Assistant Professional'))
   order by r.available_at limit 10 for update of r skip locked`);
  for(const job of jobs.rows){
   const recipients=await client.query<{id:string}>(`select distinct p.id from person p join user_account ua on ua.person_id=p.id and ua.active
    join club_membership cm on cm.person_id=p.id and cm.club_id=$1 and cm.active
    where p.active and (p.id=$2 or exists(select 1 from dependants where club_id=$1 and guardian_person_id=p.id and dependant_person_id=$2 and active)) order by p.id`,[job.club_id,job.player_person_id]);
   const when=new Date(job.starts_at).toLocaleString('en-IE',{timeZone:'Europe/Dublin',weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
   const duration=Math.round((new Date(job.ends_at).getTime()-new Date(job.starts_at).getTime())/60000);
   for(const recipient of recipients.rows){
    if(recipient.id!==job.player_person_id&&!(await client.query('select id from dependants where guardian_person_id=$1 and dependant_person_id=$2 and club_id=$3 and active for share',[recipient.id,job.player_person_id,job.club_id])).rows[0])continue;
    if(await createNotification(client,recipient.id,{type:'lesson_reminder',title:'Your lesson is coming up',body:`${job.player_name} has ${job.title}, a ${duration}-minute lesson with ${job.professional_name} at ${job.club_name} on ${when} (Dublin).`,
     href:`/lessons?booking=${job.booking_id}#booking-${job.booking_id}`,eventKey:`lesson-reminder:${job.booking_id}:${job.revision}`,expiresAt:job.starts_at}))stats.published++;
   }
   // sent_at now means the reminder event has been published to shared delivery.
   // Queue revision plus notification event keys prevent duplicate delivery.
   await client.query('update lesson_reminder set sent_at=now(),locked_until=null where booking_id=$1 and revision=$2',[job.booking_id,job.revision]);
   if(!recipients.rows.length)stats.skipped++;
  }
 });
 if(stats.published)scheduleNotificationPush();
 return stats;
}
