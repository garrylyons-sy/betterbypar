import type {PoolClient} from 'pg';
import {withTransaction} from '@/lib/server/db';
import {golfAccess,AccessError,requirePlayerAccess} from '@/lib/server/golf-access';
import {createNotification} from '@/lib/server/notifications';
import type {CoachPlayer,ReviewedRound,RoundComment} from '@/lib/round-coaching-types';
const id=(v:unknown)=>{if(typeof v!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))throw new AccessError('Choose a valid round or player.',400);return v;};
async function coachFor(c:PoolClient,actor:string,club:string,player:string){return Boolean((await c.query('select public.is_round_coach($1,$2,$3) ok',[actor,club,player])).rows[0].ok);}
async function roundAccess(c:PoolClient,actor:string,rid:unknown,coachOnly=false){
 const row=(await c.query('select * from golf_round where id=$1 for share',[id(rid)])).rows[0];if(!row)throw new AccessError('Round not found.',404);
 if(row.data.status!=='completed')throw new AccessError('Only completed rounds are available for coaching.');
 const coach=await coachFor(c,actor,row.club_id,row.player_person_id);if(!coach||!coachOnly){if(!coach)await requirePlayerAccess(c,actor,row.player_person_id,row.club_id);}if(coachOnly&&!coach)throw new AccessError('You can review rounds only for players you currently coach.');
 return {row,coach};
}
const detail=(r:Record<string,any>):ReviewedRound=>({id:r.id,clubId:r.club_id,playerId:r.player_person_id,revision:r.revision,source:r.source,data:r.data,importedGross:r.imported_gross,importedPoints:r.imported_points,feedback:r.feedback_revision===r.revision?r.feedback:null});
async function comments(c:PoolClient,rid:string):Promise<RoundComment[]>{return (await c.query(`select n.id,n.author_person_id as "authorId",concat_ws(' ',p.first_name,p.last_name) as "authorName",exists(select 1 from club_membership cm join golf_round r on r.id=n.round_id where cm.person_id=p.id and cm.club_id=r.club_id and cm.role in ('Golf Professional','Assistant Professional')) as coach,n.hole_number as "holeNumber",n.body,n.round_revision as revision,n.created_at as "createdAt" from golf_round_comment n join person p on p.id=n.author_person_id where n.round_id=$1 order by n.created_at,n.id`,[rid])).rows;}
export async function getRoundCoaching(request:Request){
 const {user}=await golfAccess(request),params=new URL(request.url).searchParams,coach=params.get('view')==='coach';
 return withTransaction(async c=>{
  if(!coach){const {row}=await roundAccess(c,user.personId,params.get('roundId'));await requirePlayerAccess(c,user.personId,row.player_person_id,row.club_id);return {coach:false,options:[],selected:null,rounds:[],hasMore:false,round:detail(row),comments:await comments(c,row.id)};}
  const options=(await c.query<CoachPlayer>(`select cl.id as "clubId",cl.name as "clubName",p.id as "playerId",concat_ws(' ',p.first_name,p.last_name) as name from club cl join person p on public.is_round_coach($1,cl.id,p.id) order by cl.name,p.first_name,p.last_name,p.id`,[user.personId])).rows;
  if(!options.length){if(params.has('roundId')||params.has('playerId')||params.has('clubId'))throw new AccessError('You can review rounds only for players you currently coach.');return {coach:true,options,selected:null,rounds:[],hasMore:false,round:null,comments:[]};}
  const explicit=params.has('roundId')?await roundAccess(c,user.personId,params.get('roundId'),true):null;
  const club=params.get('clubId')??explicit?.row.club_id,player=params.get('playerId')??explicit?.row.player_person_id;
  const selected=options.find(p=>(!club||p.clubId===club)&&(!player||p.playerId===player));if(!selected)throw new AccessError('Choose a player you coach at this club.');
  if(explicit&&(explicit.row.club_id!==selected.clubId||explicit.row.player_person_id!==selected.playerId))throw new AccessError('This round belongs to another player or club.');
  const offset=Number(params.get('offset')??0);if(!Number.isInteger(offset)||offset<0||offset>100000)throw new AccessError('Invalid history page.',400);
  const rows=(await c.query(`select id,data->>'courseName' as "courseName",data->>'playedOn' as "playedOn",imported_gross as gross,source from golf_round where club_id=$1 and player_person_id=$2 and data->>'status'='completed' order by data->>'playedOn' desc,created_at desc,id desc limit 51 offset $3`,[selected.clubId,selected.playerId,offset])).rows;
  const active=explicit??(rows[0]?await roundAccess(c,user.personId,rows[0].id,true):null);
  return {coach:true,options,selected,rounds:rows.slice(0,50),hasMore:rows.length>50,round:active?detail(active.row):null,comments:active?await comments(c,active.row.id):[]};
 });
}
export async function postRoundComment(request:Request,b:Record<string,unknown>){
 const {user}=await golfAccess(request);
 return withTransaction(async c=>{
  const {row,coach}=await roundAccess(c,user.personId,b.roundId),clientKey=id(b.clientKey);
  const body=typeof b.body==='string'?b.body.trim():'';if(!body||body.length>3000)throw new AccessError('Write a comment of 1–3000 characters.',400);
  const hole=b.holeNumber??null;if(hole!==null&&(!Number.isInteger(hole)||Number(hole)<1||Number(hole)>row.data.holeCount))throw new AccessError('Choose a hole from this round.',400);
  if(b.revision!==row.revision)throw new AccessError('The player updated this round. Refresh before adding feedback.',409);
  const inserted=(await c.query(`insert into golf_round_comment(round_id,author_person_id,client_key,round_revision,hole_number,body) values($1,$2,$3,$4,$5,$6) on conflict(author_person_id,client_key) do nothing returning id`,[row.id,user.personId,clientKey,row.revision,hole,body])).rows[0];
  if(!inserted){const prior=(await c.query('select * from golf_round_comment where author_person_id=$1 and client_key=$2',[user.personId,clientKey])).rows[0];if(prior.round_id!==row.id||prior.round_revision!==row.revision||prior.hole_number!==hole||prior.body!==body)throw new AccessError('This request was already saved with different details. Refresh and try again.',409);return {id:prior.id};}
  const recipients=(await c.query<{id:string}>(coach?`select distinct p.id from person p join user_account ua on ua.person_id=p.id and ua.active where p.id<>$3 and public.can_discuss_round(p.id,$1) and (p.id=$2 or exists(select 1 from dependants d where d.guardian_person_id=p.id and d.dependant_person_id=$2 and d.club_id=$4 and d.active))`:`select distinct n.author_person_id id from golf_round_comment n join user_account ua on ua.person_id=n.author_person_id and ua.active where n.round_id=$1 and n.author_person_id<>$3 and public.is_round_coach(n.author_person_id,$4,$2)`,[row.id,row.player_person_id,user.personId,row.club_id])).rows;
  for(const recipient of recipients)await createNotification(c,recipient.id,{type:'round_comment',title:coach?'Your professional reviewed a round':'Player replied to your round review',body:'Open the round to read the coaching discussion.',href:`/rounds/${coach?'review':'coaching'}?roundId=${row.id}`,eventKey:`round-comment:${inserted.id}`});
  return {id:inserted.id};
 });
}
