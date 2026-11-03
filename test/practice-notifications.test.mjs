import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createRequire}from'node:module';
import{PGlite}from'@electric-sql/pglite';import{btree_gist}from'@electric-sql/pglite/contrib/btree_gist';import{pgcrypto}from'@electric-sql/pglite/contrib/pgcrypto';import{initializeLocalDemo}from'../scripts/local-demo-database.mjs';import * as policy from '../lib/notification-policy.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');const load=(file,deps)=>{const api={};new Function('require','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name in deps?deps[name]:require(name),api);return api;};
test('practice events follow existing coaching preferences for no notification, push, email or both',()=>{
 for(const type of ['coaching_assignment','coaching_progress','round_comment']){
 assert.equal(policy.notificationPreferenceType(type),'lesson_feedback');
 const config=policy.normalizeNotificationConfig({version:5,enabled:true,enabledTypes:['lesson_feedback'],eligibleRoles:['Club Member'],quietStart:'00:00',quietEnd:'00:00'});
 for(const [push,email]of [[false,false],[true,false],[false,true],[true,true]]){const prefs=policy.normalizeNotificationPreferences({version:5,pushEnabled:push,pushTypes:['lesson_feedback'],emailEnabled:email,emailTypes:['lesson_feedback'],inboxTypes:[]});assert.equal(policy.canDeliverPush({type},prefs,config,['Club Member']),push);assert.equal(policy.canDeliverEmail({type},prefs,config,['Club Member']),email);}
 }
});
test('practice notifications address current guardians and assigned coaches and revalidate cancelled/revoked sources',async()=>{
 const db=await PGlite.create({extensions:{btree_gist,pgcrypto}});try{
 await initializeLocalDemo(db);await db.exec(readFileSync('supabase/practice_coach_reviews.sql','utf8'));const query=async(...args)=>{const r=await db.query(...args);return{...r,rowCount:r.affectedRows||r.rows.length};};
 const api=load('lib/server/notifications.ts',{'@/lib/server/db':{dbQuery:query},'@/lib/cup-draw-inbox.mjs':{},'@/lib/notification-policy.mjs':policy});const publisher=load('lib/server/practice-notifications.ts',{'@/lib/server/notifications':api});
 const people=Object.fromEntries((await query('select email,id from person')).rows.map(p=>[p.email,p.id])),parent=people['parent@example.test'],coach=people['professional@example.test'];const child=(await query("select id from person where first_name='Casey'")).rows[0].id;const club=(await query("select id from club where name='Castle Golf Club'")).rows[0].id,drill=(await query('select id,definition from golf_drill limit 1')).rows[0];
 const assignment=(await query(`insert into golf_practice_assignment(club_id,player_person_id,coach_person_id,created_by,client_key,kind,drill_id,definition,starts_on) values($1,$2,$3,$3,$4,'drill',$5,$6,current_date) returning id`,[club,child,coach,crypto.randomUUID(),drill.id,drill.definition])).rows[0].id;
 await publisher.notifyPracticeAssignment({query},assignment);const event=(await query("select * from app_notification where event_key=$1",[`practice-assigned:${assignment}`])).rows;assert.equal(event.length,1);assert.equal(event[0].person_id,parent);
 const current=(person,type,key)=>api.notificationSourceIsCurrent('unused',person,{query},{type,event_key:key});assert.equal(await current(parent,'coaching_assignment',event[0].event_key),true);assert.equal(await current(people['member@example.test'],'coaching_assignment',event[0].event_key),false);
 await query('update dependants set active=false where guardian_person_id=$1',[parent]);assert.equal(await current(parent,'coaching_assignment',event[0].event_key),false);
 const session=(await query('insert into golf_drill_session(assignment_id,actor_person_id,client_key,performed_on,minutes) values($1,$2,$3,current_date,10) returning id',[assignment,parent,crypto.randomUUID()])).rows[0].id;
 await query('update dependants set active=true where guardian_person_id=$1',[parent]);
 const review=(await query(`insert into golf_practice_coach_review(assignment_id,reviewer_person_id,drill_session_id,client_key,outcome,comment) values($1,$2,$3,$4,'successful','Good work') returning id`,[assignment,coach,session,crypto.randomUUID()])).rows[0].id;
 await publisher.notifyPracticeReview({query},assignment,review);const reviewEvent=(await query('select * from app_notification where event_key=$1',[`practice-review:${review}`])).rows[0];assert.equal(reviewEvent.person_id,parent);assert.equal(reviewEvent.type,'lesson_feedback');
 assert.equal(await current(parent,'lesson_feedback',reviewEvent.event_key),true);
 assert.equal(await current(people['member@example.test'],'lesson_feedback',reviewEvent.event_key),false);
 await query('update dependants set active=false where guardian_person_id=$1',[parent]);assert.equal(await current(parent,'lesson_feedback',reviewEvent.event_key),false);
 await query('update dependants set active=true where guardian_person_id=$1',[parent]);
 await query("insert into club_membership(person_id,club_id,role,active) values($1,$2,'Golf Professional',true) on conflict(club_id,person_id,role) do update set active=true",[people['assistant@example.test'],club]);
 await query('update club_membership set active=false where person_id=$1 and club_id=$2',[coach,club]);assert.equal(await current(parent,'lesson_feedback',reviewEvent.event_key),false);
 await query('update club_membership set active=true where person_id=$1 and club_id=$2',[coach,club]);assert.equal(await current(parent,'lesson_feedback',reviewEvent.event_key),true);
 const challenge=(await query('select id,definition from golf_challenge limit 1')).rows[0];
 const challengeAssignment=(await query(`insert into golf_practice_assignment(club_id,player_person_id,coach_person_id,created_by,client_key,kind,challenge_id,definition,starts_on) values($1,$2,$3,$3,$4,'challenge',$5,$6,current_date) returning id`,[club,child,coach,crypto.randomUUID(),challenge.id,challenge.definition])).rows[0].id;
 const round=(await query(`insert into golf_round(club_id,player_person_id,created_by,source,data) values($1,$2,$3,'manual','{}') returning id,revision`,[club,child,parent])).rows[0];
 const attempt=(await query(`insert into golf_challenge_attempt(assignment_id,actor_person_id,client_key,round_id,round_revision,performed_on,result) values($1,$2,$3,$4,$5,current_date,'{"outcome":"passed","evidence":"player_recorded","detail":"Goal met"}') returning id`,[challengeAssignment,parent,crypto.randomUUID(),round.id,round.revision])).rows[0].id;
 const challengeReview=(await query(`insert into golf_practice_coach_review(assignment_id,reviewer_person_id,challenge_attempt_id,client_key,outcome,comment) values($1,$2,$3,$4,'successful','Good scoring') returning id`,[challengeAssignment,coach,attempt,crypto.randomUUID()])).rows[0].id;
 const challengeReviewKey=`practice-review:${challengeReview}`;assert.equal(await current(parent,'lesson_feedback',challengeReviewKey),true);
 await query('update golf_round set revision=revision+1 where id=$1',[round.id]);assert.equal(await current(parent,'lesson_feedback',challengeReviewKey),false);
 await query('delete from golf_round where id=$1',[round.id]);assert.equal(await current(parent,'lesson_feedback',challengeReviewKey),false);assert.equal((await query('select id from golf_practice_coach_review where id=$1',[challengeReview])).rows.length,0);
 await publisher.notifyPracticeProgress({query},assignment,session,'drill');const progress=(await query("select * from app_notification where type='coaching_progress'")).rows[0];assert.equal(progress.person_id,coach);assert.equal(await current(coach,'coaching_progress',progress.event_key),true);
 await query("update golf_practice_assignment set status='cancelled' where id=$1",[assignment]);assert.equal(await current(coach,'coaching_progress',progress.event_key),false);assert.equal(await current(parent,'lesson_feedback',reviewEvent.event_key),false);
 }finally{await db.close();}
});
