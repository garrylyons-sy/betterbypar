import webpush from 'web-push';
import { createECDH } from 'node:crypto';
import { canDeliverPush, isQuietTime, safeNotificationHref } from '@/lib/notification-policy.mjs';
import { pushFailureAction, validatePushSubscription } from '@/lib/notification-push-policy.mjs';
import { dbQuery } from '@/lib/server/db';
import { notificationAccess, notificationSourceIsCurrent } from '@/lib/server/notifications';

function vapidDetails() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || '';
  if (!publicKey || !privateKey || !subject) return null;
  try {
    const contact=new URL(subject);
    if(!['mailto:','https:'].includes(contact.protocol))return null;
    const key=createECDH('prime256v1');key.setPrivateKey(Buffer.from(privateKey,'base64url'));
    if(key.getPublicKey().toString('base64url')!==publicKey)return null;
    return {subject,publicKey,privateKey};
  } catch { return null; }
}

export function pushReadiness() {
  const details = vapidDetails();
  return {ready:!!details,publicKey:details?.publicKey || null};
}

export async function subscribeNotificationPush(personId:string,input:unknown) {
  const subscription=validatePushSubscription(input);
  // Never transfer an endpoint between accounts: possession of a public endpoint is not ownership proof.
  const result=await dbQuery(`insert into public.notification_push_subscription (person_id,endpoint,p256dh,auth,active)
    values ($1,$2,$3,$4,true) on conflict (endpoint) do update set p256dh=excluded.p256dh,
    auth=excluded.auth,active=true,updated_at=now()
    where notification_push_subscription.person_id=excluded.person_id returning id`,[personId,subscription.endpoint,subscription.keys.p256dh,subscription.keys.auth]);
  return result.rowCount !== 0;
}

type Delivery = {id:string;notification_id:string;subscription_id:string;person_id:string;endpoint:string;p256dh:string;auth:string;active:boolean;type:string;title:string;body:string;href:string;read_at:Date|null;expires_at:Date|null;attempts:number;lock_token:string};

export async function processNotificationPush() {
  const stats={claimed:0,sent:0,skipped:0,retried:0,failed:0};
  const details=vapidDetails();
  if(!details)return stats;
  const deadline=Date.now()+35000;
  const deliver=async(job:Delivery)=>{
    const finish=async(status:string,error:string|null=null,delay=0)=>dbQuery(`update public.notification_push_delivery set status=$3,last_error=$4,
      available_at=now()+($5*interval '1 second'),sent_at=case when $3='Sent' then now() else sent_at end,
      attempts=case when $3='Pending' and $4::text is null then greatest(0,attempts-1) else attempts end,locked_at=null
      where id=$1 and status='Sending' and locked_at=$2::timestamptz`,[job.id,job.lock_token,status,error,delay]);
    try {
      const access=await notificationAccess(job.person_id);
      if(!access.eligible || !await notificationSourceIsCurrent(job.notification_id,job.person_id,undefined,undefined,access.config.retentionDays)){
        await finish('Skipped');stats.skipped++;return;
      }
      // Read immediately before sending: another device may have read this inbox item
      // or unsubscribed while the job was waiting for an earlier provider request.
      const freshResult=await dbQuery<{read_at:Date|null;expires_at:Date|null;active:boolean}>(`select n.read_at,least(coalesce(n.expires_at,n.created_at+($3::int*interval '24 hours')),n.created_at+($3::int*interval '24 hours')) as expires_at,s.active
        from public.app_notification n join public.notification_push_subscription s on s.id=$2 and s.person_id=n.person_id
        where n.id=$1 and n.person_id=$4`,[job.notification_id,job.subscription_id,access.config.retentionDays,job.person_id]);
      const fresh=freshResult.rows[0];
      if(!fresh?.active || !canDeliverPush({...job,...fresh},access.preferences,{...access.config,quietStart:'00:00',quietEnd:'00:00'},access.roles)){
        await finish('Skipped');stats.skipped++;return;
      }
      if(isQuietTime(new Date(),access.config)){await finish('Pending',null,300);stats.retried++;return;}
      const remaining=fresh.expires_at ? Math.floor((new Date(fresh.expires_at).getTime()-Date.now())/1000) : 3600;
      if(remaining<=0){await finish('Skipped');stats.skipped++;return;}
      // Leave the lock reclaimable if database work used up the current run's budget.
      const timeout=Math.min(5000,deadline-Date.now()-1000);
      if(timeout<1000){await finish('Pending',null,30);stats.retried++;return;}
      const subscription=validatePushSubscription({endpoint:job.endpoint,keys:{p256dh:job.p256dh,auth:job.auth}});
      await webpush.sendNotification(subscription,JSON.stringify({title:job.title,body:job.body,href:safeNotificationHref(job.href),tag:job.notification_id,expiresAt:fresh.expires_at ? new Date(fresh.expires_at).toISOString() : null}),{
        vapidDetails:details,TTL:Math.min(3600,remaining),timeout
      });
      await finish('Sent');stats.sent++;
    }catch(error){
      const statusCode=typeof error==='object' && error && 'statusCode' in error ? Number(error.statusCode):undefined;
      const action=pushFailureAction(statusCode,job.attempts);
      if(action.deactivate)await dbQuery('update public.notification_push_subscription set active=false,updated_at=now() where id=$1',[job.subscription_id]);
      // Do not persist endpoint URLs, subscription secrets, or raw provider response bodies.
      await finish(action.status,statusCode?`Push provider status ${statusCode}`:'Push delivery failed',action.delaySeconds);
      if(action.status==='Pending')stats.retried++;else stats.failed++;
    }
  };
  // Drain fast providers beyond one batch, while reserving time for the last wave
  // to finish inside the cron budget. Deferred jobs cannot be reclaimed this run.
  while(Date.now()<deadline-6000){
    // Each claim is atomic, and old workers can only update the lock they hold.
    const {rows}=await dbQuery<Delivery>(`with due as (
      select id from public.notification_push_delivery where (status='Pending' and available_at<=now())
        or (status='Sending' and locked_at<now()-interval '10 minutes')
      order by available_at limit 5 for update skip locked
    ), claimed as (
      update public.notification_push_delivery d set status='Sending',locked_at=clock_timestamp(),attempts=d.attempts+1
      from due where d.id=due.id returning d.*
    ) select d.*,d.locked_at::text as lock_token,n.person_id,n.type,n.title,n.body,n.href,n.read_at,n.expires_at,s.endpoint,s.p256dh,s.auth,s.active
      from claimed d join public.app_notification n on n.id=d.notification_id
      join public.notification_push_subscription s on s.id=d.subscription_id and s.person_id=n.person_id`);
    if(!rows.length)break;
    stats.claimed+=rows.length;
    await Promise.all(rows.map(deliver));
  }
  return stats;
}
