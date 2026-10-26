import {processNotificationEmail} from '@/lib/server/notification-email';
import {processNotificationPush} from '@/lib/server/notification-push';
import {NextResponse} from 'next/server';
import {dbQuery} from '@/lib/server/db';
import {materializeLessons} from '@/lib/server/lesson-diary';
import {processLessonReminders} from '@/lib/server/lesson-reminders';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized.'},{status:401});
 try{
  const clubs=(await dbQuery('select id from club where active')).rows;
  for(const club of clubs)await materializeLessons([club.id],(await dbQuery(`select professional_person_id as id from lesson_default_week where club_id=$1 union select professional_person_id from lesson_week_override where club_id=$1 limit 1`,[club.id])).rows[0]?.id??'00000000-0000-0000-0000-000000000000');
  const reminders=await processLessonReminders();
  const [push,email]=await Promise.all([processNotificationPush(),processNotificationEmail()]);
  return NextResponse.json({ok:true,...reminders,push,email},{headers:{'Cache-Control':'no-store'}});
 }catch(error){console.error('lessons:scheduled-process',error);return NextResponse.json({error:'Lesson processing failed.'},{status:500});}
}
