import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import {PGlite} from '@electric-sql/pglite';import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';import {initializeLocalDemo} from '../scripts/local-demo-database.mjs';import * as catalogue from '../shared/course-catalogue.mjs';import {normalizeRound} from '../lib/golf-rounds.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
function load(file,deps){const api={};new Function('require','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>deps[id]??require(id),api);return api;}
test('manual courses remain private until an administrator publishes verified details; reviews are atomic and deduplicated',async()=>{
 const db=await PGlite.create({extensions:{pgcrypto,btree_gist}});try{
  await initializeLocalDemo(db);const member=(await db.query("select id from person where email='member@example.test'")).rows[0].id,admin=(await db.query("select id from person where email='admin@example.test'")).rows[0].id,club=(await db.query("select id from club where name='Castle Golf Club'")).rows[0].id;
  class AccessError extends Error{constructor(message,status=403){super(message);this.status=status;}}
  const tx=fn=>db.transaction(fn),courseService=load('lib/server/course-catalogue.ts',{'@/lib/server/db':{withTransaction:tx},'@/lib/server/golf-access':{AccessError},'@/shared/course-catalogue.mjs':catalogue});
  const service=load('lib/server/course-approval.ts',{'./db':{withTransaction:tx},'./golf-access':{AccessError,golfAudit:async(client,person,label,metadata)=>client.query("insert into user_activity_log(person_id,activity_type,page_path,page_label,metadata) values($1,'Page Visit','/admin',$2,$3::jsonb)",[person,label,JSON.stringify(metadata)])},'./course-catalogue':courseService,'@/shared/course-catalogue.mjs':catalogue});
  const data=normalizeRound({courseName:'Unlisted Links',teeName:'White',playedOn:'2026-11-04',holeCount:9,format:'strokes',status:'draft',holes:[]});
  const round=(await db.query("insert into golf_round(club_id,player_person_id,created_by,source,data) values($1,$2,$2,'manual',$3::jsonb) returning *",[club,member,JSON.stringify(data)])).rows[0];
  await courseService.queueManualCourse(db,round,member);await courseService.queueManualCourse(db,round,member);
  assert.equal((await db.query('select count(*)::int n from golf_course_submission')).rows[0].n,1);
  assert.ok(!(await courseService.readCourseCatalogue(db)).courses.some(c=>c.name==='Unlisted Links'));
  assert.equal((await db.query('select data from golf_round where id=$1',[round.id])).rows[0].data.courseName,'Unlisted Links');
  const id=(await db.query('select id from golf_course_submission')).rows[0].id,actor={platform:true,user:{personId:admin}};
  const input={id,action:'approve',clubName:'Unlisted Golf Club',courseName:'Unlisted Links',teeName:'White',sourceUrl:'https://example.test/scorecard',ratingCategory:'unspecified',pars:Array(18).fill(4)};
  await assert.rejects(service.reviewManualCourse({...actor,platform:false},input),e=>e.status===403);
  await assert.rejects(service.reviewManualCourse(actor,{...input,pars:Array(9).fill(4)}),e=>e.status===400);
  assert.equal((await db.query('select status from golf_course_submission where id=$1',[id])).rows[0].status,'pending');
  await service.reviewManualCourse(actor,input);
  const published=(await courseService.readCourseCatalogue(db)).courses.find(c=>c.name==='Unlisted Links');assert.ok(published);assert.equal(published.tees[0].courseRating,null);assert.equal(published.tees[0].holes.length,18);
  await assert.rejects(service.reviewManualCourse(actor,input),e=>e.status===409);
  await courseService.queueManualCourse(db,round,member);assert.equal((await db.query('select status from golf_course_submission where id=$1',[id])).rows[0].status,'approved');
  await db.query("update golf_round set data=jsonb_set(data,'{courseName}','\"Rejected Course\"'::jsonb) where id=$1",[round.id]);
  const changed=(await db.query('select * from golf_round where id=$1',[round.id])).rows[0];await courseService.queueManualCourse(db,changed,member);
  const rejection=(await db.query("select id from golf_course_submission where status='pending'")).rows[0].id;
  await service.reviewManualCourse(actor,{id:rejection,action:'reject',note:'Need a published scorecard.'});
  assert.ok(!(await courseService.readCourseCatalogue(db)).courses.some(c=>c.name==='Rejected Course'));
  assert.equal((await db.query('select data from golf_round where id=$1',[round.id])).rows[0].data.courseName,'Rejected Course');
  assert.equal((await db.query("select count(*)::int n from user_activity_log where page_label in ('Manual course approved','Manual course rejected')")).rows[0].n,2);
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='golf_course_submission'::regclass")).rows[0].relrowsecurity,true);
 }finally{await db.close();}
});
