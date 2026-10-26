import type {PoolClient} from 'pg';
import {withTransaction} from '@/lib/server/db';
import {golfAccess,AccessError,requirePlayerAccess} from '@/lib/server/golf-access';
import {normalizeRound,roundStats,type RoundInput,type SavedRound,type RoundFeedback} from '@/lib/golf-rounds.mjs';
import {getGolfSummary} from '@/lib/server/golf-ireland';
import {importGolfRound} from '@/lib/server/round-import';
import {generateRoundFeedback} from '@/lib/server/round-feedback.mjs';
type Option={clubId:string;clubName:string;playerId:string;name:string;golfIrelandNumber:string};
type Row={id:string;club_id:string;player_person_id:string;source:SavedRound['source'];external_score_uid:string|null;data:RoundInput;revision:number;imported_gross:number|null;imported_points:number|null;feedback:RoundFeedback|null;feedback_revision:number|null;feedback_generated_at:Date|null;feedback_requested_at:Date|null;updated_at:Date};
const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const view=(row:Row):SavedRound=>({...row.data,id:row.id,source:row.source,externalScoreUid:row.external_score_uid,revision:row.revision,importedGross:row.imported_gross,importedPoints:row.imported_points,feedback:row.feedback_revision===row.revision?row.feedback:null,feedbackGeneratedAt:row.feedback_generated_at?.toISOString()??null,updatedAt:row.updated_at.toISOString(),stats:roundStats(row.data)});
function normalize(input:unknown,imported=false){try{return normalizeRound({...input as object,imported});}catch(error){throw new AccessError(error instanceof Error?error.message:'Invalid round.',400);}}
async function optionsFor(client:PoolClient,actor:string){
 return (await client.query<Option>(`select c.id as "clubId",c.name as "clubName",p.id as "playerId",concat_ws(' ',p.first_name,p.last_name) as name,p.golf_ireland_number as "golfIrelandNumber"
 from club c join club_membership cm on cm.club_id=c.id and cm.person_id=$1 and cm.active join person p on public.is_golf_player(p.id,c.id)
 where c.active and (p.id=$1 or exists(select 1 from dependants d where d.club_id=c.id and d.guardian_person_id=$1 and d.dependant_person_id=p.id and d.active))
 group by c.id,c.name,p.id order by (p.id=$1) desc,c.name,p.first_name,p.last_name,p.id`,[actor])).rows;
}
async function context(client:PoolClient,actor:string,clubId?:unknown,playerId?:unknown){
 const options=await optionsFor(client,actor);
 if((clubId&&!uuid(clubId))||(playerId&&!uuid(playerId)))throw new AccessError('Choose a valid club and player.',400);
 const selected=options.find(p=>(!clubId||p.clubId===clubId)&&(!playerId||p.playerId===playerId));
 if(!selected&&(clubId||playerId))throw new AccessError('Choose your own player profile or an active dependant.');
 if(selected)await requirePlayerAccess(client,actor,selected.playerId,selected.clubId);
 return {options,selected};
}
async function owned(client:PoolClient,actor:string,id:unknown){
 if(!uuid(id))throw new AccessError('Choose a valid round.',400);
 const row=(await client.query<Row>('select * from golf_round where id=$1 for update',[id])).rows[0];
 if(!row)throw new AccessError('Round not found.',404);
 await requirePlayerAccess(client,actor,row.player_person_id,row.club_id);return row;
}
const requestFor=(option:Option)=>({clubId:option.clubId,clubName:option.clubName,playerId:option.playerId,playerName:option.name,golfIrelandNumber:option.golfIrelandNumber});
export async function getRoundJournal(request:Request){
 const {user}=await golfAccess(request),params=new URL(request.url).searchParams;
 const offset=Number(params.get('offset')??0);if(!Number.isInteger(offset)||offset<0||offset>100000)throw new AccessError('Invalid history page.',400);
 const result=await withTransaction(async client=>{
  const {options,selected}=await context(client,user.personId,params.get('clubId'),params.get('playerId'));
  let rows:Row[]=[];
  if(params.has('roundId')){const row=await owned(client,user.personId,params.get('roundId'));if(!selected||row.club_id!==selected.clubId||row.player_person_id!==selected.playerId)throw new AccessError('This round belongs to a different player or club.');rows=[row];}
  else if(selected)rows=(await client.query<Row>(`select * from golf_round where club_id=$1 and player_person_id=$2 order by data->>'playedOn' desc,updated_at desc,id desc limit 51 offset $3`,[selected.clubId,selected.playerId,offset])).rows;
  return {options,selected,rounds:rows.slice(0,50).map(view),hasMore:rows.length>50};
 });
 const env=process.env,aiMode=env.LOCAL_DEMO==='1'?'demo':env.ROUND_AI_MODE==='live'&&env.OPENAI_API_KEY?'live':env.ROUND_AI_MODE==='demo'?'demo':'off';
 let imports=null;
 if(params.get('imports')==='1'&&result.selected){
  const summary=await getGolfSummary(requestFor(result.selected));imports={mode:summary.mode,rounds:summary.recentRounds};
 }
 return {...result,aiMode,imports};
}
export async function saveRoundJournal(request:Request,body:Record<string,unknown>){
 const {user}=await golfAccess(request);
 if(body.action==='create')return withTransaction(async client=>{
  const {selected}=await context(client,user.personId,body.clubId,body.playerId);if(!selected)throw new AccessError('A registered player is required.');
  const data=normalize(body.data);
  const row=(await client.query<Row>(`insert into golf_round(club_id,player_person_id,created_by,source,data) values($1,$2,$3,'manual',$4::jsonb) returning *`,[selected.clubId,selected.playerId,user.personId,JSON.stringify(data)])).rows[0];
  return {round:view(row)};
 });
 if(body.action==='import'){
  if(typeof body.scoreUID!=='string'||body.scoreUID.length>100)throw new AccessError('Choose an importable round.',400);
  const selected=await withTransaction(async client=>(await context(client,user.personId,body.clubId,body.playerId)).selected);if(!selected)throw new AccessError('A registered player is required.');
  const imported=await importGolfRound(requestFor(selected),body.scoreUID);const data=normalize(imported.data,true);
  return withTransaction(async client=>{
   await requirePlayerAccess(client,user.personId,selected.playerId,selected.clubId);
   const added=(await client.query<Row>(`insert into golf_round(club_id,player_person_id,created_by,source,external_score_uid,data,imported_gross,imported_points) values($1,$2,$3,$4,$5,$6::jsonb,$7,$8) on conflict(player_person_id,source,external_score_uid) do nothing returning *`,[selected.clubId,selected.playerId,user.personId,imported.source,imported.externalScoreUid,JSON.stringify(data),imported.importedGross,imported.importedPoints])).rows[0];
   const row=added??(await client.query<Row>('select * from golf_round where club_id=$1 and player_person_id=$2 and source=$3 and external_score_uid=$4',[selected.clubId,selected.playerId,imported.source,imported.externalScoreUid])).rows[0];
   if(!row)throw new AccessError('This round is already saved in another club context.',409);
   return {round:view(row),alreadyImported:!added};
  });
 }
 if(body.action==='save')return withTransaction(async client=>{
  const row=await owned(client,user.personId,body.roundId);
  if(row.revision!==body.revision)throw new AccessError('This round changed elsewhere. Reload it before saving.',409);
  const data=normalize(body.data,row.source!=='manual');
  if(row.source!=='manual'){
   const scoreFields=(r:RoundInput)=>({courseName:r.courseName,teeName:r.teeName,playedOn:r.playedOn,holeCount:r.holeCount,format:r.format,status:r.status,handicapIndex:r.handicapIndex,playingHandicap:r.playingHandicap,holes:r.holes.map(h=>({number:h.number,par:h.par,strokes:h.strokes,status:h.status}))});
   if(JSON.stringify(scoreFields(data))!==JSON.stringify(scoreFields(row.data)))throw new AccessError('Imported scores are read-only. Add commentary, putts, penalties or shot observations instead.',400);
  }
  const updated=(await client.query<Row>(`update golf_round set data=$2::jsonb,revision=revision+1,feedback=null,feedback_revision=null,feedback_generated_at=null,updated_at=now() where id=$1 returning *`,[row.id,JSON.stringify(data)])).rows[0];
  return {round:view(updated)};
 });
 if(body.action==='feedback'){
  if(body.consent!==true)throw new AccessError('Choose Get feedback to share the saved round for coaching.',400);
  const prepared=await withTransaction(async client=>{
   const row=await owned(client,user.personId,body.roundId);
   if(row.data.status!=='completed')throw new AccessError('Finish and save the round before requesting feedback.',400);
   if(row.feedback&&row.feedback_revision===row.revision)return {row,cached:true,history:[]};
   if(row.feedback_requested_at&&Date.now()-row.feedback_requested_at.getTime()<60000)throw new AccessError('Feedback is already being prepared. Please wait a moment.',429);
   // Keep a persistent rate limit even after edits or provider failures.
   await client.query('update golf_round set feedback_requested_at=now() where id=$1',[row.id]);
   const history=(await client.query<Row>(`select * from golf_round where player_person_id=$1 and club_id=$2 and id<>$3 and data->>'status'='completed' and data->>'playedOn' <= $4 order by data->>'playedOn' desc limit 3`,[row.player_person_id,row.club_id,row.id,row.data.playedOn])).rows.map(r=>r.data);
   return {row,cached:false,history};
  });
  if(prepared.cached)return {round:view(prepared.row)};
  const feedback=await generateRoundFeedback(view(prepared.row),prepared.history);
  return withTransaction(async client=>{
   const current=await owned(client,user.personId,prepared.row.id);
   if(current.revision!==prepared.row.revision)throw new AccessError('The round changed while feedback was being prepared. Request feedback for the saved version.',409);
   const row=(await client.query<Row>('update golf_round set feedback=$2::jsonb,feedback_revision=revision,feedback_generated_at=now() where id=$1 returning *',[current.id,JSON.stringify(feedback)])).rows[0];
   return {round:view(row)};
  });
 }
 throw new AccessError('Unknown round action.',400);
}
