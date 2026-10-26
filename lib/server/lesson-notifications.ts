import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {createNotification} from '@/lib/server/notifications';

export type LessonEventKind = 'lesson_booking' | 'lesson_cancelled' | 'lesson_feedback';

// Write only durable notification work here. Delivery is scheduled after commit.
export async function notifyLessonEvent(client:PoolClient,bookingId:string,kind:LessonEventKind,actorId?:string):Promise<number> {
 const result=await client.query(`select b.id,b.player_person_id,b.status,b.feedback,b.drills,s.club_id,s.professional_person_id,s.starts_at,s.ends_at,
  coalesce(g.name,s.title) as title,concat_ws(' ',player.first_name,player.last_name) as player_name,
  concat_ws(' ',coach.first_name,coach.last_name) as professional_name
  from lesson_booking b join lesson_slot s on s.id=b.slot_id left join lesson_group g on g.id=s.group_id
  join club c on c.id=s.club_id and c.active
  join person player on player.id=b.player_person_id and player.active
  join person coach on coach.id=s.professional_person_id
  where b.id=$1 and public.is_golf_player(player.id,s.club_id)`,[bookingId]);
 const booking=result.rows[0];if(!booking)return 0;
 if(kind==='lesson_cancelled'?booking.status!=='Cancelled':booking.status!=='Booked')return 0;
 if(kind==='lesson_feedback'&&!String(booking.feedback??'').trim()&&!String(booking.drills??'').trim())return 0;
 const recipients=await client.query<{id:string;participant:boolean}>(`select distinct p.id,
  (p.id=$2 or exists(select 1 from dependants d where d.guardian_person_id=p.id and d.dependant_person_id=$2 and d.club_id=$1 and d.active)) as participant
  from person p join user_account ua on ua.person_id=p.id and ua.active
  join club_membership cm on cm.person_id=p.id and cm.club_id=$1 and cm.active
  where p.active and (p.id=$2
   or exists(select 1 from dependants d where d.guardian_person_id=p.id and d.dependant_person_id=$2 and d.club_id=$1 and d.active)
   or ($4::boolean and p.id=$3 and p.id is distinct from $5::uuid and cm.role in ('Golf Professional','Assistant Professional')))
  order by p.id`,[booking.club_id,booking.player_person_id,booking.professional_person_id,kind!=='lesson_feedback',actorId??null]);
 const when=new Date(booking.starts_at).toLocaleString('en-IE',{timeZone:'Europe/Dublin',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 const revision=kind==='lesson_feedback'?createHash('sha256').update(JSON.stringify([booking.feedback??'',booking.drills??''])).digest('hex'):'';
 const eventKey=kind==='lesson_booking'?`lesson-booked:${bookingId}`:kind==='lesson_cancelled'?`lesson-cancelled:${bookingId}`:`lesson-feedback:${bookingId}:${revision}`;
 const title=kind==='lesson_booking'?'Lesson booked':kind==='lesson_cancelled'?'Lesson cancelled':'Lesson feedback ready';
 const description=`${booking.title} for ${booking.player_name} with ${booking.professional_name} on ${when} (Dublin)`;
 let notified=0;
 for(const recipient of recipients.rows){
  if(recipient.participant&&recipient.id!==booking.player_person_id){
   const grant=await client.query('select id from dependants where guardian_person_id=$1 and dependant_person_id=$2 and club_id=$3 and active for share',[recipient.id,booking.player_person_id,booking.club_id]);
   if(!grant.rowCount)continue;
  }
  if(await createNotification(client,recipient.id,{type:kind,title,
   body:kind==='lesson_feedback'?`Feedback and drills are ready for ${description}. Open your booking to view them.`:`${description} has been ${kind==='lesson_booking'?'booked':'cancelled'}.`,
   href:recipient.participant?`/lessons?booking=${bookingId}#booking-${bookingId}`:'/lessons/manage',eventKey,
   expiresAt:kind==='lesson_booking'?booking.ends_at:kind==='lesson_feedback'?new Date(Date.now()+30*86400000):null}))notified++;
 }
 return notified;
}
