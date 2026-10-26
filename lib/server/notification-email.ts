import {dbQuery} from '@/lib/server/db';
import {notificationAccess,notificationSourceIsCurrent} from '@/lib/server/notifications';
import {canDeliverEmail,isQuietTime,safeNotificationHref} from '@/lib/notification-policy.mjs';
import {sendAppEmail,escapeHtml,appBaseUrl} from '@/lib/server/email';
export function notificationEmailReady(){return process.env.LOCAL_DEMO!=='1'&&Boolean(process.env.RESEND_API_KEY&&(process.env.INVITE_FROM_EMAIL||process.env.EMAIL_FROM));}
type Delivery={id:string;notification_id:string;person_id:string;type:string;title:string;body:string;href:string;expires_at:Date|null;attempts:number;lock_token:string};
// Provider I/O is outside the transaction that published the event.
export async function processNotificationEmail(){
 const stats={claimed:0,sent:0,skipped:0,retried:0,failed:0,emailReady:notificationEmailReady()};
 if(!stats.emailReady)return stats;
 const jobs=await dbQuery<Delivery>(`with due as (
  select id from public.notification_email_delivery where (status='Pending' and available_at<=now() and attempts<5) or (status='Sending' and locked_at<now()-interval '10 minutes')
  order by available_at limit 3 for update skip locked
 ), claimed as (
  update public.notification_email_delivery d set status='Sending',attempts=d.attempts+1,locked_at=clock_timestamp() from due where d.id=due.id returning d.*
 ) select d.*,d.locked_at::text as lock_token,n.person_id,n.type,n.title,n.body,n.href,n.expires_at from claimed d join public.app_notification n on n.id=d.notification_id`);
 for(const job of jobs.rows){
  stats.claimed++;
  const finish=async(status:string,error:string|null=null,delay=0)=>dbQuery(`update public.notification_email_delivery set status=$3,last_error=$4,available_at=now()+$5*interval '1 second',
   sent_at=case when $3='Sent' then now() else sent_at end,attempts=case when $3='Pending' and $4::text is null then greatest(0,attempts-1) else attempts end,locked_at=null
   where id=$1 and status='Sending' and locked_at=$2::timestamptz`,[job.id,job.lock_token,status,error,delay]);
  try{
   const access=await notificationAccess(job.person_id);
   if(!access.eligible||!canDeliverEmail(job,access.preferences,{...access.config,quietStart:'00:00',quietEnd:'00:00'},access.roles)||!await notificationSourceIsCurrent(job.notification_id,job.person_id,undefined,undefined,access.config.retentionDays)){
    await finish('Skipped');stats.skipped++;continue;
   }
   if(isQuietTime(new Date(),access.config)){await finish('Pending',null,300);stats.retried++;continue;}
   // Re-read the address at delivery time. No email address is copied into the outbox.
   const recipient=await dbQuery<{email:string}>(`select p.email from public.person p where p.id=$1 and p.active and p.email is not null and exists(select 1 from public.user_account where person_id=p.id and active)`,[job.person_id]);
   const email=recipient.rows[0]?.email;if(!email){await finish('Skipped');stats.skipped++;continue;}
   const href=new URL(safeNotificationHref(job.href),appBaseUrl()).toString();
   const sent=await sendAppEmail({to:email,subject:job.title,text:`${job.body}\n\nView details: ${href}`,html:`<p>${escapeHtml(job.body).replaceAll('\n','<br>')}</p><p><a href="${escapeHtml(href)}">View details</a></p>`,idempotencyKey:`notification-${job.notification_id}`});
   if(sent.status==='Sent'){await finish('Sent');stats.sent++;}
   else{const failed=job.attempts>=5;await finish(failed?'Failed':'Pending','Email delivery failed',300);if(failed)stats.failed++;else stats.retried++;}
  }catch{
   const failed=job.attempts>=5;await finish(failed?'Failed':'Pending','Email delivery failed',300);if(failed)stats.failed++;else stats.retried++;
  }
 }
 return stats;
}
