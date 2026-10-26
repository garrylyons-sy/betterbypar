import {notifyLessonEvent} from '@/lib/server/lesson-notifications';
import {scheduleNotificationPush} from '@/lib/server/notification-dispatch';
import {NextResponse} from 'next/server';
import {withTransaction} from '@/lib/server/db';
import {golfAccess,golfError,AccessError,golfAudit} from '@/lib/server/golf-access';
import {requireActiveCoach} from '@/lib/server/lesson-diary';
import {lessonText} from '@/lib/lesson-diary.mjs';
export async function PATCH(request:Request){
 try{
  const a=await golfAccess(request),b=await request.json(),feedback=lessonText(b.feedback,4000,'Feedback'),drills=lessonText(b.drills,4000,'Drills');
  await withTransaction(async client=>{
   const result=await client.query(`select b.*,s.professional_person_id,s.club_id from lesson_booking b join lesson_slot s on s.id=b.slot_id where b.id=$1 for update of b`,[String(b.bookingId??'')]);
   const booking=result.rows[0];if(!booking)throw new Error('Booking not found.');
   if(booking.professional_person_id!==a.user.personId)throw new AccessError('Only the lesson professional can write feedback and drills.');
   await requireActiveCoach(client,booking.club_id,a.user.personId);
   if(booking.status!=='Booked'||new Date(booking.ends_at)>new Date())throw new Error('Feedback is available after a completed lesson.');
   await client.query('update lesson_booking set feedback=$2,drills=$3,feedback_by=$4,feedback_at=now() where id=$1',[booking.id,feedback,drills,a.user.personId]);
   if((booking.feedback!==feedback||booking.drills!==drills)&&(feedback||drills))await notifyLessonEvent(client,booking.id,'lesson_feedback',a.user.personId);
   await golfAudit(client,a.user.personId,'Lesson feedback saved',{bookingId:booking.id});
  });scheduleNotificationPush();return NextResponse.json({ok:true});
 }catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
