import {dbQuery} from '@/lib/server/db';
import {AnnouncementError} from '@/lib/server/notification-announcements';
function pageNumber(value:string){
 if(!/^[1-9]\d*$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)>1000000)throw new AnnouncementError('Choose a valid history page.');
 return Number(value);
}
export async function loadPublisherHistory(senderPersonId:string,value='1'){
 const requested=pageNumber(value),pageSize=10;
 const count=await dbQuery<{total:number}>('select count(*)::int as total from public.notification_announcement where sender_person_id=$1',[senderPersonId]);
 const total=Number(count.rows[0]?.total??0),totalPages=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(requested,totalPages);
 const result=await dbQuery(`select id,title,summary,created_at as "createdAt" from public.notification_announcement where sender_person_id=$1 order by created_at desc,id desc limit $2 offset $3`,[senderPersonId,pageSize,(page-1)*pageSize]);
 return {items:result.rows,page,pageSize,total,totalPages};
}
export async function loadPublisherMessage(senderPersonId:string,id:string,value='1'){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new AnnouncementError('Choose a valid message.');
 const requested=pageNumber(value);
 // Check ownership before returning any contents or querying recipients.
 const result=await dbQuery<{id:string;title:string;body:string;audience:unknown;summary:unknown;createdAt:string;recipients:unknown[]|null}>(`select id,title,body,audience,summary,created_at as "createdAt",recipients from public.notification_announcement where id=$1 and sender_person_id=$2`,[id,senderPersonId]);
 if(!result.rows[0])throw new AnnouncementError('Message not found.',404);
 const {recipients:snapshot,...message}=result.rows[0];
 const source=snapshot===null?`select n.person_id as "personId",coalesce(nullif(concat_ws(' ',p.first_name,p.last_name),''),'Former recipient') as name,case when n.inbox_visible then true else null end as inbox,case when exists(select 1 from public.notification_push_delivery d where d.notification_id=n.id) then true else null end as push,n.read_at as "readAt",n.opened_at as "openedAt" from public.app_notification n left join public.person p on p.id=n.person_id where n.type='announcement' and n.event_key=$2 and $1::jsonb is null`:`select r."personId",r.name,r.inbox,r.push,coalesce(n.read_at,r."readAt") as "readAt",coalesce(n.opened_at,r."openedAt") as "openedAt" from jsonb_to_recordset($1::jsonb) as r("personId" uuid,name text,inbox boolean,push boolean,"readAt" timestamptz,"openedAt" timestamptz) left join public.app_notification n on n.person_id=r."personId" and n.event_key=$2 and n.type='announcement'`;
 const params=[snapshot===null?null:JSON.stringify(snapshot),`announcement:${message.id}`];
 const count=await dbQuery<{total:number}>(`select count(*)::int as total from (${source}) recipients`,params);
 const recipientTotal=Number(count.rows[0]?.total??0),recipientPageSize=25,recipientTotalPages=Math.max(1,Math.ceil(recipientTotal/recipientPageSize)),recipientPage=Math.min(requested,recipientTotalPages);
 const rows=await dbQuery(`select * from (${source}) recipients order by lower(name),"personId" limit $3 offset $4`,[...params,recipientPageSize,(recipientPage-1)*recipientPageSize]);
 return {...message,recipients:rows.rows,recipientSource:snapshot===null?'legacy':'snapshot',recipientTotal,recipientPage,recipientPageSize,recipientTotalPages};
}
