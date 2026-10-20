import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/server/auth';
import { withTransaction } from '@/lib/server/db';
import { notificationAccess } from '@/lib/server/notifications';
import { pushReadiness } from '@/lib/server/notification-push';
import { scheduleNotificationPush } from '@/lib/server/notification-dispatch';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});
  const access=await notificationAccess(user.personId);
  if(!access.eligible)return NextResponse.json({error:'Notifications are unavailable.'},{status:403});
  if(!pushReadiness().ready)return NextResponse.json({error:'Push notifications are not configured.'},{status:503});
  const type=access.preferences.pushTypes.find(type=>access.config.enabledTypes.includes(type));
  if(!access.preferences.pushEnabled || !type)return NextResponse.json({error:'Enable push and at least one notification category first.'},{status:400});
  const result=await withTransaction(async client=>{
    const devices=await client.query('select id from public.notification_push_subscription where person_id=$1 and active=true',[user.personId]);
    if(!devices.rowCount)return 'missing';
    const recent=await client.query(`select id from public.app_notification where person_id=$1 and event_key like 'push-test:%' and created_at>now()-interval '1 minute' limit 1`,[user.personId]);
    if(recent.rowCount)return 'limited';
    const id=randomUUID();
    await client.query(`insert into public.app_notification(id,person_id,type,title,body,href,event_key,expires_at)
      values ($1,$2,$3,'Test notification','Push notifications are working on your devices.','/',$4,now()+interval '1 hour')`,[id,user.personId,type,`push-test:${randomUUID()}`]);
    await client.query(`insert into public.notification_push_delivery(notification_id,subscription_id)
      select $1,id from public.notification_push_subscription where person_id=$2 and active=true on conflict do nothing`,[id,user.personId]);
    return 'queued';
  });
  if(result==='missing')return NextResponse.json({error:'Enable notifications on this device first.'},{status:400});
  if(result==='limited')return NextResponse.json({error:'Wait one minute before sending another test.'},{status:429});
  scheduleNotificationPush();
  return NextResponse.json({queued:true});
}
