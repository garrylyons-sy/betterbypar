import {processNotificationEmail} from '@/lib/server/notification-email';
import {processLessonReminders} from '@/lib/server/lesson-reminders';
import {NextResponse} from 'next/server';
import {processNotificationReminders} from '@/lib/server/notifications';
import {processNotificationPush} from '@/lib/server/notification-push';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request:Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({error:'Unauthorized.'}, {status: 401});
  try {
    const lessons = await processLessonReminders();
    const reminders = await processNotificationReminders();
    const [push,email]=await Promise.all([processNotificationPush(),processNotificationEmail()]);
    return NextResponse.json({ok:true,reminders,lessons,push,email}, {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    console.error('notifications:scheduled-process', error);
    return NextResponse.json({error:'Scheduled notification processing failed.'}, {status:500});
  }
}
