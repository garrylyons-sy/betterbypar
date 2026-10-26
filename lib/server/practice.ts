import type {PoolClient} from 'pg';
import {withTransaction} from '@/lib/server/db';
import {golfAccess,AccessError,requirePlayerAccess,type GolfAccess} from '@/lib/server/golf-access';
import {normalizeChallenge,normalizeDrill,evaluateChallenge,type ChallengeDefinition} from '@/lib/practice-policy.mjs';
import type {SavedRound,RoundInput} from '@/lib/golf-rounds.mjs';
import type {PracticeOption} from '@/lib/practice-types';
import {notifyPracticeAssignment,notifyPracticeProgress} from '@/lib/server/practice-notifications';
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const id=(v:unknown)=>{if(!uuid(v))throw new AccessError('Choose a valid item.',400);return v;};
const str=(v:unknown,max=2000)=>{if(v==null)return '';if(typeof v!=='string'||v.length>max)throw new AccessError(`Text must be at most ${max} characters.`,400);return v.trim();};
const day=(value:unknown)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new AccessError('Choose a valid date.',400);return value;};
const isoDay=(value:Date|string)=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Dublin'});
const duplicateConflict=()=>{throw new AccessError('This request was already saved with different details. Refresh and try again.',409);};
const kindOf=(value:unknown)=>{if(value!=='challenge'&&value!=='drill')throw new AccessError('Choose challenges or drills.',400);return value;};
async function managerClubs(c:PoolClient,a:GolfAccess){
 const ids=[...new Set([...a.adminClubIds,...a.assignments.filter(m=>['Golf Professional','Assistant Professional'].includes(m.role)).map(m=>m.clubId)])];
 return (await c.query<{id:string;name:string}>(`select c.id,c.name from club c where c.active and (($2::boolean and exists(select 1 from app_operator where person_id=$1 and active)) or (c.id=any($3::uuid[]) and (exists(select 1 from club_admin where club_id=c.id and person_id=$1 and active) or exists(select 1 from club_membership where club_id=c.id and person_id=$1 and active and (is_club_admin or role in ('Golf Professional','Assistant Professional')))))) order by c.name`,[a.user.personId,a.platform,ids])).rows;
}
async function requireManage(c:PoolClient,a:GolfAccess,clubId:string){if(!(await managerClubs(c,a)).some(club=>club.id===clubId))throw new AccessError('Professional or club administrator access required.');}
async function playerOptions(c:PoolClient,actor:string){return (await c.query<PracticeOption>(`select cl.id as "clubId",cl.name as "clubName",p.id as "playerId",concat_ws(' ',p.first_name,p.last_name) as name from club cl join club_membership cm on cm.club_id=cl.id and cm.person_id=$1 and cm.active join person p on public.is_golf_player(p.id,cl.id) where cl.active and (p.id=$1 or exists(select 1 from dependants d where d.club_id=cl.id and d.guardian_person_id=$1 and d.dependant_person_id=p.id and d.active)) group by cl.id,p.id order by (p.id=$1) desc,cl.name,p.first_name,p.last_name,p.id`,[actor])).rows;}
async function assignment(c:PoolClient,value:unknown){const row=(await c.query('select * from golf_practice_assignment where id=$1 for update',[id(value)])).rows[0];if(!row)throw new AccessError('Assignment not found.',404);return row;}
function inWindow(row:Record<string,any>,value:unknown){const date=day(value);if(date>today()||date<isoDay(row.starts_on)||(row.due_on&&date>isoDay(row.due_on)))throw new AccessError('Use a completed date within the assignment period.',400);return date;}
async function roundFor(c:PoolClient,row:Record<string,any>,value:unknown){
 const r=(await c.query<{id:string;data:RoundInput;revision:number;source:SavedRound['source'];imported_gross:number|null}>('select id,data,revision,source,imported_gross from golf_round where id=$1 and player_person_id=$2 and club_id=$3 for share',[id(value),row.player_person_id,row.club_id])).rows[0];
 if(!r)throw new AccessError('Choose a saved round for this player and club.');
 inWindow(row,r.data.playedOn);return {...r.data,id:r.id,revision:r.revision,source:r.source,importedGross:r.imported_gross} as SavedRound;
}
export async function getPractice(request:Request){
 const a=await golfAccess(request),params=new URL(request.url).searchParams,manager=params.get('view')==='coach';
 return withTransaction(async c=>{
  const clubs=manager?await managerClubs(c,a):[];if(manager&&!clubs.length)throw new AccessError('Professional or administrator access required.');
  let options:PracticeOption[]=[],selected:PracticeOption|null=null,clubId='';
  if(manager){clubId=params.get('clubId')??clubs[0].id;if(!clubs.some(club=>club.id===clubId))throw new AccessError('Club access required.');options=(await c.query<PracticeOption>(`select c.id as "clubId",c.name as "clubName",p.id as "playerId",concat_ws(' ',p.first_name,p.last_name) as name from club c join person p on public.is_golf_player(p.id,c.id) where c.id=$1 order by p.first_name,p.last_name`,[clubId])).rows;}
  else{
   options=await playerOptions(c,a.user.personId);const requestedPlayer=params.get('playerId'),requestedClub=params.get('clubId');
   selected=options.find(p=>(!requestedPlayer||p.playerId===requestedPlayer)&&(!requestedClub||p.clubId===requestedClub))??null;
   if(!selected&&(requestedPlayer||requestedClub))throw new AccessError('Player access required.');
   if(selected){clubId=selected.clubId;await requirePlayerAccess(c,a.user.personId,selected.playerId,selected.clubId);}
  }
  const coaches=manager?(await c.query(`select distinct p.id,concat_ws(' ',p.first_name,p.last_name) as name from person p join club_membership cm on cm.person_id=p.id where p.active and cm.active and cm.club_id=$1 and cm.role in ('Golf Professional','Assistant Professional') order by name`,[clubId])).rows:[];
  const templates=async(table:string)=>manager?(await c.query(`select id,club_id as "clubId",definition,active from ${table} where active and (club_id is null or club_id=$1) order by definition->>'title'`,[clubId])).rows:[];
  const challenges=await templates('golf_challenge'),drills=await templates('golf_drill');
  const assignments=clubId?(await c.query(`select a.id,a.source_round_id as "sourceRoundId",a.club_id as "clubId",cl.name as "clubName",a.player_person_id as "playerId",concat_ws(' ',p.first_name,p.last_name) as "playerName",a.coach_person_id as "coachId",concat_ws(' ',coach.first_name,coach.last_name) as "coachName",a.kind,a.definition,a.status,a.notes,to_char(a.starts_on,'YYYY-MM-DD') as "startsOn",to_char(a.due_on,'YYYY-MM-DD') as "dueOn",a.target_holes as "targetHoles",a.goal_sessions as "goalSessions",
   coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'performedOn',to_char(s.performed_on,'YYYY-MM-DD'),'minutes',s.minutes,'note',s.note,'recordedBy',concat_ws(' ',actor.first_name,actor.last_name)) order by s.performed_on desc,s.created_at desc) from golf_drill_session s join person actor on actor.id=s.actor_person_id where s.assignment_id=a.id),'[]'::jsonb) as sessions,
   (select jsonb_build_object('id',at.id,'performedOn',to_char(at.performed_on,'YYYY-MM-DD'),'note',at.note,'attested',at.attested,'result',at.result,'recordedBy',concat_ws(' ',actor.first_name,actor.last_name),'stale',at.round_id is not null and at.round_revision is distinct from r.revision) from golf_challenge_attempt at join person actor on actor.id=at.actor_person_id left join golf_round r on r.id=at.round_id where at.assignment_id=a.id order by at.created_at desc,at.id desc limit 1) as "latestAttempt"
   from golf_practice_assignment a join club cl on cl.id=a.club_id join person p on p.id=a.player_person_id join person coach on coach.id=a.coach_person_id where a.club_id=$1 and public.is_golf_player(p.id,a.club_id) and ($2::boolean or a.player_person_id=$3) order by a.created_at desc,a.id desc`,[clubId,manager,selected?.playerId??null])).rows:[];
  const rounds=!manager&&selected?(await c.query(`select id,data->>'courseName' as "courseName",data->>'playedOn' as "playedOn",source from golf_round where club_id=$1 and player_person_id=$2 and data->>'status'='completed' order by data->>'playedOn' desc,updated_at desc`,[clubId,selected.playerId])).rows:[];
  return {manager,actorId:a.user.personId,clubs,clubId,options,selected,coaches,challenges,drills,assignments,rounds};
 });
}
export async function savePractice(request:Request,b:Record<string,unknown>){
 const a=await golfAccess(request);
 return withTransaction(async c=>{
  if(b.action==='save_template'||b.action==='archive_template'){
   const kind=kindOf(b.kind),clubId=id(b.clubId),table=kind==='challenge'?'golf_challenge':'golf_drill';await requireManage(c,a,clubId);
   let existing;if(b.templateId){existing=(await c.query(`select * from ${table} where id=$1 for update`,[id(b.templateId)])).rows[0];if(!existing||existing.club_id!==clubId)throw new AccessError('Built-in or other-club templates cannot be changed. Create a club copy instead.');}
   if(b.action==='archive_template'){if(!existing)throw new AccessError('Choose a template.',400);await c.query(`update ${table} set active=false,updated_at=now() where id=$1`,[existing.id]);return {id:existing.id};}
   let definition;try{definition=kind==='challenge'?normalizeChallenge(b.definition):normalizeDrill(b.definition);}catch(error){throw new AccessError(error instanceof Error?error.message:'Invalid template.',400);}
   const result=existing?await c.query(`update ${table} set definition=$2::jsonb,updated_at=now() where id=$1 returning id`,[existing.id,JSON.stringify(definition)]):await c.query(`insert into ${table}(club_id,created_by,definition) values($1,$2,$3::jsonb) returning id`,[clubId,a.user.personId,JSON.stringify(definition)]);return {id:result.rows[0].id};
  }
  if(b.action==='assign'){
   const clubId=id(b.clubId),kind=kindOf(b.kind),coachId=id(b.coachId),playerId=id(b.playerId),clientKey=id(b.clientKey);await requireManage(c,a,clubId);
   if(!a.platform&&!a.adminClubIds.includes(clubId)&&coachId!==a.user.personId)throw new AccessError('Assign goals as yourself. Administrators may assign on behalf of a professional.');
   const coach=await c.query(`select cm.id from club_membership cm join person p on p.id=cm.person_id and p.active join club cl on cl.id=cm.club_id and cl.active where cm.club_id=$1 and cm.person_id=$2 and cm.active and cm.role in ('Golf Professional','Assistant Professional') for share of cm,p,cl`,[clubId,coachId]);if(!coach.rowCount)throw new AccessError('Choose an active professional at this club.',400);
   const player=await c.query('select p.id from person p join club_membership cm on cm.person_id=p.id where cm.club_id=$1 and cm.active and p.id=$2 and public.is_golf_player(p.id,$1) for share of p,cm',[clubId,playerId]);if(!player.rowCount)throw new AccessError('Choose a registered player at this club.',400);
   const table=kind==='challenge'?'golf_challenge':'golf_drill',template=(await c.query(`select * from ${table} where id=$1 and active and (club_id is null or club_id=$2) for share`,[id(b.templateId),clubId])).rows[0];if(!template)throw new AccessError('Choose an active library item.',400);
   const starts=day(b.startsOn),due=b.dueOn?day(b.dueOn):null;if(due&&due<starts)throw new AccessError('Due date must be on or after the start date.',400);
   const holes=b.targetHoles??18,sessions=b.goalSessions??3;if(![9,18].includes(holes as number)||!Number.isInteger(sessions)||Number(sessions)<1||Number(sessions)>30)throw new AccessError('Choose 9/18 holes and 1–30 practice sessions.',400);
   const sourceRoundId=b.sourceRoundId?id(b.sourceRoundId):null;if(sourceRoundId&&!(await c.query("select id from golf_round where id=$1 and club_id=$2 and player_person_id=$3 and data->>'status'='completed' and public.is_round_coach($4,$2,$3) for share",[sourceRoundId,clubId,playerId,coachId])).rows[0])throw new AccessError('Choose a completed round for this player and professional.',400);
   const inserted=await c.query(`insert into golf_practice_assignment(club_id,player_person_id,coach_person_id,created_by,client_key,kind,challenge_id,drill_id,definition,notes,starts_on,due_on,target_holes,goal_sessions,source_round_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15) on conflict(created_by,client_key) do nothing returning id`,[clubId,playerId,coachId,a.user.personId,clientKey,kind,kind==='challenge'?template.id:null,kind==='drill'?template.id:null,JSON.stringify(template.definition),str(b.notes),starts,due,holes,sessions,sourceRoundId]);
   if(inserted.rows[0]){await notifyPracticeAssignment(c,inserted.rows[0].id);return {id:inserted.rows[0].id};}
   const prior=(await c.query('select * from golf_practice_assignment where created_by=$1 and client_key=$2',[a.user.personId,clientKey])).rows[0];if(prior.source_round_id!==sourceRoundId||prior.club_id!==clubId||prior.player_person_id!==playerId||prior.coach_person_id!==coachId||prior.kind!==kind||(prior.challenge_id??prior.drill_id)!==template.id||isoDay(prior.starts_on)!==starts||(prior.due_on?isoDay(prior.due_on):null)!==due||prior.target_holes!==holes||prior.goal_sessions!==sessions||prior.notes!==str(b.notes))duplicateConflict();return {id:prior.id};
  }
  const row=await assignment(c,b.assignmentId);
  if(b.action==='cancel'){
   await requireManage(c,a,row.club_id);if(!a.platform&&!a.adminClubIds.includes(row.club_id)&&row.coach_person_id!==a.user.personId)throw new AccessError('Only the assigned professional or administrator can cancel this goal.');
   await c.query("update golf_practice_assignment set status='cancelled',updated_at=now() where id=$1",[row.id]);return {id:row.id};
  }
  await requirePlayerAccess(c,a.user.personId,row.player_person_id,row.club_id);
  if(row.status!=='active')throw new AccessError('This assignment has been cancelled.',400);
  const clientKey=id(b.clientKey),note=str(b.note,1000);
  if(b.action==='log'){
   if(row.kind!=='drill')throw new AccessError('Choose a drill assignment.',400);
   const performed=inWindow(row,b.performedOn),minutes=Number(b.minutes);if(!Number.isInteger(minutes)||minutes<1||minutes>180)throw new AccessError('Record 1 to 180 minutes.',400);
   const result=await c.query(`insert into golf_drill_session(assignment_id,actor_person_id,client_key,performed_on,minutes,note) values($1,$2,$3,$4,$5,$6) on conflict(assignment_id,client_key) do nothing returning id`,[row.id,a.user.personId,clientKey,performed,minutes,note]);if(result.rows[0]){await notifyPracticeProgress(c,row.id,result.rows[0].id,'drill');return {id:result.rows[0].id};}const prior=(await c.query('select * from golf_drill_session where assignment_id=$1 and client_key=$2',[row.id,clientKey])).rows[0];if(isoDay(prior.performed_on)!==performed||prior.minutes!==minutes||prior.note!==note)duplicateConflict();return {id:prior.id};
  }
  if(b.action==='check'||b.action==='attest'){
   if(row.kind!=='challenge')throw new AccessError('Choose a challenge assignment.',400);
   const definition=row.definition as ChallengeDefinition,round=b.roundId?await roundFor(c,row,b.roundId):null;
   let result=evaluateChallenge(definition,round,row.target_holes),performed=round?round.playedOn:inWindow(row,b.performedOn);
   const attested=b.action==='attest';
   if(attested){
    if(b.confirmed!==true||typeof b.met!=='boolean'||!note)throw new AccessError('Confirm the result and add a short attestation note.',400);
    if(result.outcome!=='needs_attestation')throw new AccessError('This card can be checked directly or is ineligible. Use a complete round within the assigned period.',400);
    if(!['no_lost_balls','custom'].includes(definition.rule)&&!round)throw new AccessError('Choose the completed round you are attesting to.',400);
    result={outcome:b.met?'passed':'not_met',evidence:'attestation',detail:`${b.met?'Met':'Did not meet'} the ${row.target_holes}-hole goal, confirmed by the player or guardian.`};
   }else if(!round)throw new AccessError('Choose a saved round to check.',400);
   const inserted=await c.query(`insert into golf_challenge_attempt(assignment_id,actor_person_id,client_key,round_id,round_revision,performed_on,result,attested,note) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) on conflict(assignment_id,client_key) do nothing returning id`,[row.id,a.user.personId,clientKey,round?.id??null,round?.revision??null,performed,JSON.stringify(result),attested,note]);if(inserted.rows[0]&&['passed','not_met'].includes(result.outcome))await notifyPracticeProgress(c,row.id,inserted.rows[0].id,'challenge');if(inserted.rows[0])return {id:inserted.rows[0].id,result};const prior=(await c.query('select * from golf_challenge_attempt where assignment_id=$1 and client_key=$2',[row.id,clientKey])).rows[0];if(prior.round_id!==(round?.id??null)||prior.round_revision!==(round?.revision??null)||isoDay(prior.performed_on)!==performed||prior.attested!==attested||prior.note!==note||prior.result.outcome!==result.outcome||prior.result.evidence!==result.evidence||prior.result.detail!==result.detail)duplicateConflict();return {id:prior.id,result:prior.result};
  }
  throw new AccessError('Unknown practice action.',400);
 });
}
