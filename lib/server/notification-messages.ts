import {isEligibleForNotification} from '@/lib/notification-policy.mjs';
import {dbQuery,withTransaction} from '@/lib/server/db';
import {notificationAccess,syncAnnouncementReceipts} from '@/lib/server/notifications';
export class MessageAccessError extends Error{constructor(message:string,public status=404){super(message);}}
async function accessFor(personId:string,id:string){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new MessageAccessError('Choose a valid message.',400);
 const access=await notificationAccess(personId);
 if(!access.eligible||!isEligibleForNotification('announcement',access.roles,access.config))throw new MessageAccessError('Notification access required.',403);
 return access;
}
const available=`person_id=$1 and type='announcement' and event_key=$2 and created_at>now()-($3::int*interval '24 hours') and (expires_at is null or expires_at>now())`;
export async function loadRecipientMessage(personId:string,id:string){
 const access=await accessFor(personId,id);
 // Deliberately allow inbox_visible=false for push-only recipients. Dismissed
 // messages are denied by expires_at; nobody can retrieve another person's row.
 const result=await dbQuery<{id:string;title:string;body:string;createdAt:Date;availableUntil:Date}>(`select id,title,body,created_at as "createdAt",least(coalesce(expires_at,'infinity'::timestamptz),created_at+($3::int*interval '24 hours')) as "availableUntil" from public.app_notification where ${available}`,[personId,`announcement:${id.toLowerCase()}`,access.config.retentionDays]);
 if(!result.rows[0])throw new MessageAccessError('This message is unavailable or has expired.');
 return {...result.rows[0],announcementId:id.toLowerCase()};
}
export async function recordMessageOpened(personId:string,id:string){
 const access=await accessFor(personId,id);
 return withTransaction(async client=>{
 const result=await client.query<{event_key:string;read_at:Date;opened_at:Date}>(`update public.app_notification set opened_at=coalesce(opened_at,now()),read_at=coalesce(read_at,now()) where ${available} returning event_key,read_at,opened_at`,[personId,`announcement:${id.toLowerCase()}`,access.config.retentionDays]);
 if(!result.rows[0])throw new MessageAccessError('This message is unavailable or has expired.');
 await syncAnnouncementReceipts(client,personId,result.rows);
 return {openedAt:result.rows[0].opened_at};
 });
}
