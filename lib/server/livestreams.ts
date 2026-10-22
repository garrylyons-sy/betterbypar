import {notifyLivestreamViewers} from '@/lib/server/livestream-notifications';
import {scheduleNotificationPush} from '@/lib/server/notification-dispatch';
import type {PoolClient} from 'pg';
import {dbQuery,withTransaction} from '@/lib/server/db';
import {validateLiveDraft} from '@/lib/livestream-policy.mjs';
import type {LiveFixture,MatchLivestream,LivestreamResponse} from '@/lib/livestream-types';
// The legacy publisher_person_id column records stream ownership; app_video controls permission.
type Queryable=Pick<PoolClient,'query'>;
export class LiveStreamError extends Error {constructor(message:string,public status:number){super(message);}}
export async function livestreamAccess(personId:string,client:Queryable={query:dbQuery} as Queryable){
 const {rows}=await client.query<{canBroadcast:boolean;canView:boolean}>(`select
  exists(select 1 from public.app_video where person_id=p.id and active) as "canBroadcast",
  exists(select 1 from public.app_viewer where person_id=p.id and active) as "canView"
 from public.person p where p.id=$1 and p.active and exists(select 1 from public.user_account where person_id=p.id and active)`,[personId]);
 return rows[0]??{canBroadcast:false,canView:false};
}
async function requireVideo(personId:string,client?:Queryable){if(!(await livestreamAccess(personId,client)).canBroadcast)throw new LiveStreamError('Video access required.',403);}
const todayFixtureSql="(f.fixture_date at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date";
const fixtureColumns=`f.id,ht.name as "homeTeam",at.name as "awayTeam",f.fixture_date::text as "fixtureDate",coalesce(cc.name,l.name) as competition,f.status::text as status`;
const fixtureJoins=`from public.fixture f join public.team ht on ht.id=f.home_team_id join public.team at on at.id=f.away_team_id join public.league l on l.id=f.league_id join public.season season on season.id=f.season_id left join public.cup_competition_tie ct on ct.fixture_id=f.id left join public.cup_competition_round cr on cr.id=ct.competition_round_id left join public.cup_competition cc on cc.id=cr.competition_id`;
export async function listVideoFixtures(personId:string,search:string='',pageInput:string='1'){
 await requireVideo(personId);
 const page=Number(pageInput);if(!Number.isInteger(page)||page<1||page>10000||search.length>100)throw new LiveStreamError('Choose a valid search or page.',400);
 const result=await dbQuery<LiveFixture>(`select ${fixtureColumns} ${fixtureJoins}
 where season.active and f.status='Scheduled' and ${todayFixtureSql} and ($1='' or strpos(lower(concat_ws(' ',ht.name,at.name,l.name,cc.name)),lower($1))>0)
 order by abs(extract(epoch from f.fixture_date-now())),f.fixture_date,f.id limit 11 offset $2`,[search.trim(),(page-1)*10]);
 return {items:result.rows.slice(0,10),page,hasMore:result.rows.length>10};
}
export async function listLiveStreams(personId:string):Promise<LivestreamResponse>{
 const access=await livestreamAccess(personId);if(!access.canBroadcast&&!access.canView)throw new LiveStreamError('Viewing permission required.',403);
 const {rows}=await dbQuery<MatchLivestream>(`select ${fixtureColumns},ls.id as "streamId",ls.youtube_video_id as "videoId",concat_ws(' ',p.first_name,p.last_name) as "broadcasterName",ls.started_at::text as "startedAt",ls.expires_at::text as "expiresAt",(ls.publisher_person_id=$1 and $3) as "canEnd"
 ${fixtureJoins} join public.match_livestream ls on ls.fixture_id=f.id join public.person p on p.id=ls.publisher_person_id and p.active
 join public.app_video ap on ap.person_id=p.id and ap.active
 where ls.ended_at is null and ls.expires_at>now() and f.status<>'Cancelled'
 and exists(select 1 from public.user_account where person_id=p.id and active)
 and ($2 or ls.publisher_person_id=$1) order by ls.started_at desc,ls.id`,[personId,access.canView,access.canBroadcast]);
 return {...access,streams:rows};
}
export async function makeFixtureLive(personId:string,input:unknown){
 let draft:ReturnType<typeof validateLiveDraft>;try{draft=validateLiveDraft(input);}catch(error){throw new LiveStreamError((error as Error).message,400);}
 const result=await withTransaction(async client=>{
  await requireVideo(personId,client);
  async function saved(id:string,duplicate:boolean){
   const notifications=draft.notifyViewers?await notifyLivestreamViewers(client,id):{count:0,alreadyNotified:false};
   return {id,duplicate,notificationCount:notifications.count,notificationsAlreadySent:notifications.alreadyNotified};
  }
  const fixture=(await client.query(`select f.id from public.fixture f join public.season s on s.id=f.season_id where f.id=$1 and f.status='Scheduled' and s.active and ${todayFixtureSql} for update of f`,[draft.fixtureId])).rows[0];
  if(!fixture)throw new LiveStreamError('Choose an available match scheduled for today (Irish time).',409);
  await client.query(`update public.match_livestream set ended_at=now() where fixture_id=$1 and ended_at is null and expires_at<=now()`,[draft.fixtureId]);
  const existing=(await client.query<{id:string;publisher_person_id:string;youtube_video_id:string}>(`select id,publisher_person_id,youtube_video_id from public.match_livestream where fixture_id=$1 and ended_at is null`,[draft.fixtureId])).rows[0];
  if(existing){
   if(existing.publisher_person_id===personId&&existing.youtube_video_id===draft.videoId)return saved(existing.id,true);
   throw new LiveStreamError('This match already has a live stream. The person who made it live must end it before another can be added.',409);
  }
  const {rows}=await client.query<{id:string}>(`insert into public.match_livestream(fixture_id,publisher_person_id,youtube_video_id) values($1,$2,$3) returning id`,[draft.fixtureId,personId,draft.videoId]);
  return saved(rows[0].id,false);
 });
 if(result.notificationCount>0&&!result.notificationsAlreadySent)scheduleNotificationPush();
 return result;
}
export async function endLiveStream(personId:string,id:unknown){
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))throw new LiveStreamError('Choose a valid stream.',400);
 return withTransaction(async client=>{
  await requireVideo(personId,client);
  const result=await client.query(`update public.match_livestream set ended_at=coalesce(ended_at,now()) where id=$1 and publisher_person_id=$2 returning id`,[id,personId]);
  if(!result.rows[0])throw new LiveStreamError('Stream not found.',404);
  await client.query(`update public.app_notification set expires_at=least(expires_at,now()) where type='livestream' and event_key=$1`,[`livestream:${id}`]);
  await client.query(`update public.notification_push_delivery d set status='Skipped',locked_at=null where d.status='Pending' and exists(select 1 from public.app_notification n where n.id=d.notification_id and n.type='livestream' and n.event_key=$1)`,[`livestream:${id}`]);
  return {ok:true};
 });
}
