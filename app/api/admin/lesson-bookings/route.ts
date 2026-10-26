import {scheduleNotificationPush} from '@/lib/server/notification-dispatch';
import {NextResponse} from 'next/server';
import {dbQuery,withTransaction} from '@/lib/server/db';
import {golfAccess,golfError,requireLessonsManager} from '@/lib/server/golf-access';
import {lessonText,reminderMinutes} from '@/lib/lesson-diary.mjs';
import {bookLessonForMember} from '@/lib/server/lesson-booking';
export const runtime='nodejs';
export async function GET(request:Request){
 try{
  const a=await golfAccess(request),clubId=new URL(request.url).searchParams.get('clubId')??'';
  requireLessonsManager(a,clubId);
  const members=await dbQuery(`select distinct p.id,concat_ws(' ',p.first_name,p.last_name) as name,
   exists(select 1 from user_account where person_id=p.id and active) as on_platform
   from club_membership cm join person p on p.id=cm.person_id and p.active join club c on c.id=cm.club_id and c.active
   where cm.club_id=$1 and cm.active and public.is_golf_player(p.id,cm.club_id) order by name`,[clubId]);
  return NextResponse.json({members:members.rows});
 }catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
export async function POST(request:Request){
 try{
  const a=await golfAccess(request),b=await request.json(),goals=lessonText(b.goals,2000,'Lesson goals'),reminder=reminderMinutes(b.reminderMinutes);
  const result=await withTransaction(async client=>{
   return bookLessonForMember(client,a,String(b.slotId??''),String(b.playerId??''),goals,reminder);
  });scheduleNotificationPush();return NextResponse.json(result,{status:201});
 }catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
