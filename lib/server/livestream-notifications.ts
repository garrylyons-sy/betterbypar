import type {PoolClient} from 'pg';
import {loadNotificationConfig} from '@/lib/server/notifications';
import {normalizeNotificationPreferences} from '@/lib/notification-policy.mjs';
// Called inside makeFixtureLive's fixture-locked transaction. No provider I/O here.
export async function notifyLivestreamViewers(client:PoolClient,streamId:string){
 const stream=(await client.query<{viewers_notified_at:Date|null;viewers_notified_count:number;expires_at:Date;home_team:string;away_team:string}>(`select ls.viewers_notified_at,ls.viewers_notified_count,ls.expires_at,ht.name as home_team,at.name as away_team from public.match_livestream ls join public.fixture f on f.id=ls.fixture_id join public.team ht on ht.id=f.home_team_id join public.team at on at.id=f.away_team_id where ls.id=$1 and ls.ended_at is null and ls.expires_at>now() and f.status<>'Cancelled' for update of ls`,[streamId])).rows[0];
 if(!stream)return {count:0,alreadyNotified:false};
 if(stream.viewers_notified_at)return {count:stream.viewers_notified_count,alreadyNotified:true};
 const config=await loadNotificationConfig(client);
 let count=0;
 if(config.enabled&&config.enabledTypes.includes('announcement')){
  const {rows}=await client.query<{person_id:string;preferences:unknown;has_push:boolean}>(`select av.person_id,np.preferences,exists(select 1 from public.notification_push_subscription where person_id=av.person_id and active) as has_push
   from public.app_viewer av join public.person p on p.id=av.person_id and p.active left join public.notification_preference np on np.person_id=p.id
   where av.active and exists(select 1 from public.user_account where person_id=p.id and active)`,[]);
  const recipients=rows.flatMap(row=>{const prefs=normalizeNotificationPreferences(row.preferences);const inbox=prefs.inboxTypes.includes('announcement'),push=row.has_push&&prefs.pushEnabled&&prefs.pushTypes.includes('announcement');return inbox||push?[{personId:row.person_id,inbox,push}]:[];});
  if(recipients.length){
   const result=await client.query<{count:number}>(`with recipients as(select * from jsonb_to_recordset($1::jsonb) as r("personId" uuid,inbox boolean,push boolean)), inserted as(
    insert into public.app_notification(person_id,type,title,body,href,event_key,expires_at,inbox_visible)
    select "personId",'livestream',$2,$3,$4,$5,$6,inbox from recipients on conflict(person_id,event_key) do nothing returning id,person_id
   ), queued as(insert into public.notification_push_delivery(notification_id,subscription_id)
    select n.id,s.id from inserted n join recipients r on r."personId"=n.person_id and r.push join public.notification_push_subscription s on s.person_id=n.person_id and s.active on conflict do nothing returning id)
   select count(*)::int as count from inserted`,[JSON.stringify(recipients),`Live snooker: ${stream.home_team} v ${stream.away_team}`,`${stream.home_team} v ${stream.away_team} is live now. Tap to watch.`,`/?page=Live+matches&stream=${streamId}`,`livestream:${streamId}`,stream.expires_at]);
   count=Number(result.rows[0].count);
  }
 }
 await client.query('update public.match_livestream set viewers_notified_at=now(),viewers_notified_count=$2 where id=$1',[streamId,count]);
 return {count,alreadyNotified:false};
}
