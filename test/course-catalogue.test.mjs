import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRound} from '../lib/golf-rounds.mjs';
const course={id:'11111111-1111-4111-8111-111111111111',slug:'club-main',clubName:'Club',name:'Main',location:'Dublin',sourceUrl:'https://example.com/card',reviewedOn:'2026-11-03'};
const tee={id:'22222222-2222-4222-8222-222222222222',slug:'white-men',name:'White',colour:'white',ratingCategory:'men',par:72,courseRating:71.2,slopeRating:123,totalDistance:6000,distanceUnit:'m',sourceUrl:course.sourceUrl,reviewedOn:course.reviewedOn,holes:Array.from({length:18},(_,i)=>({number:i+1,par:4,strokeIndex:i+1,distance:300}))};
const round=()=>normalizeRound({courseName:'Manual',playedOn:'2026-11-02',holeCount:9,format:'strokes',status:'draft',holes:[]});
test('catalogue selection fills only pars, keeps unknown scores and snapshots full rated layout',async()=>{
 const api=await import('../shared/course-catalogue.mjs');
 const selected=api.applyCatalogueTee(round(),course,tee);
 assert.equal(selected.courseName,'Club — Main');assert.equal(selected.holes.length,9);assert.equal(selected.holes[0].par,4);assert.equal(selected.holes[0].strokes,null);assert.equal(selected.courseDetails.ratedHoleCount,18);assert.equal(selected.courseDetails.holes.length,18);
 assert.deepEqual(normalizeRound(selected).courseDetails,selected.courseDetails);
 tee.holes[0].par=5;assert.equal(selected.courseDetails.holes[0].par,4);tee.holes[0].par=4;
});
test('selection rejects imported cards and any started observations',async()=>{
 const {applyCatalogueTee}=await import('../shared/course-catalogue.mjs');
 assert.throws(()=>applyCatalogueTee({...round(),source:'golf_ireland'},course,tee),/Imported/);
 for(const patch of [{strokes:5},{putts:1},{penalties:1},{status:'picked_up'},{shots:[{type:'full'}]}]){const r=round();r.holes[0]={...r.holes[0],...patch};assert.throws(()=>applyCatalogueTee(r,course,tee),/started/);}
});
test('normalization rejects malformed catalogue IDs and detaches manually renamed metadata',async()=>{
 const {applyCatalogueTee}=await import('../shared/course-catalogue.mjs');const r=applyCatalogueTee(round(),course,tee);
 assert.throws(()=>normalizeRound({...r,courseDetails:{...r.courseDetails,teeId:'oops'}}),/catalogue/);
 assert.equal(normalizeRound({...r,courseName:'Other'}).courseDetails,null);
 assert.equal(normalizeRound(round()).courseDetails,undefined);
});

test('database constraints and server snapshot resolution preserve history and reject forged or started selections',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const {readFileSync}=await import('node:fs');const {createRequire}=await import('node:module');const require=createRequire(import.meta.url),ts=require('typescript');const shared=await import('../shared/course-catalogue.mjs');
 const db=await PGlite.create();try{
 await db.exec('create role anon; create role authenticated;');await db.exec(readFileSync('supabase/golf_course_catalogue.sql','utf8'));
 await db.query(`insert into golf_course(id,slug,club_name,name,source_url,reviewed_on) values($1,$2,$3,$4,$5,$6)`,[course.id,course.slug,course.clubName,course.name,course.sourceUrl,course.reviewedOn]);
 await db.query(`insert into golf_course_tee(id,course_id,slug,name,rating_category,par,course_rating,slope_rating,total_distance,distance_unit,source_url,reviewed_on) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[tee.id,course.id,tee.slug,tee.name,tee.ratingCategory,tee.par,tee.courseRating,tee.slopeRating,tee.totalDistance,tee.distanceUnit,tee.sourceUrl,tee.reviewedOn]);
 for(const h of tee.holes)await db.query('insert into golf_course_hole values($1,$2,$3,$4,$5)',[tee.id,h.number,h.par,h.strokeIndex,h.distance]);
 await assert.rejects(db.query('insert into golf_course_hole values($1,19,4,null,null)',[tee.id]),/check constraint/);
 const api={};class AccessError extends Error{constructor(m,status){super(m);this.status=status;}}
 const deps={'@/lib/server/db':{withTransaction:fn=>db.transaction(fn)},'@/lib/server/golf-access':{AccessError,golfAccess:async()=>({user:{personId:'test'}})},'@/shared/course-catalogue.mjs':shared};
 new Function('require','exports',ts.transpileModule(readFileSync('lib/server/course-catalogue.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>deps[name]??require(name),api);
 const catalogue=await api.getCourseCatalogue(new Request('http://localhost/api/courses'));assert.equal(catalogue.courses[0].tees[0].courseRating,71.2);
 const selected=shared.applyCatalogueTee(round(),course,tee);const forged={...selected,courseDetails:{...selected.courseDetails,courseRating:99}};
 const resolved=await api.resolveRoundCourseDetails(db,forged);assert.equal(resolved.courseDetails.courseRating,71.2);
 await db.query('update golf_course_tee set course_rating=75,active=false where id=$1',[tee.id]);
 const changedPars={...forged,holes:forged.holes.map(h=>({...h,par:3}))};
 const preserved=await api.resolveRoundCourseDetails(db,changedPars,resolved);assert.equal(preserved.courseDetails.courseRating,71.2);assert.equal(preserved.holes[0].par,4);
 const {courseDetails:ignored,...oldClient}=resolved;assert.equal((await api.resolveRoundCourseDetails(db,oldClient,resolved)).courseDetails.courseRating,71.2);
 assert.equal((await api.resolveRoundCourseDetails(db,{...oldClient,holes:changedPars.holes},resolved)).holes[0].par,4);
 assert.equal((await api.resolveRoundCourseDetails(db,{...oldClient,courseName:'Other'},resolved)).courseDetails,undefined);
 await assert.rejects(api.resolveRoundCourseDetails(db,selected),/available course/);
 await assert.rejects(api.resolveRoundCourseDetails(db,selected,undefined,true),/Imported/);
 await db.query('update golf_course_tee set active=true where id=$1',[tee.id]);
 const started=round();started.holes[0].status='picked_up';await assert.rejects(api.resolveRoundCourseDetails(db,selected,started),/started/);
 assert.equal((await db.query("select count(*)::int as count from pg_class where relname in ('golf_course','golf_course_tee','golf_course_hole') and relrowsecurity")).rows[0].count,3);
 }finally{await db.close();}
});

test('course setup auto-selects only an unambiguous single layout and leaves multiple layouts explicit',async()=>{
 const {soleCourseAtClub}=await import('../shared/course-catalogue.mjs');
 assert.equal(soleCourseAtClub([], 'Castle'),null);
 assert.equal(soleCourseAtClub([course],'Other club'),null);
 assert.equal(soleCourseAtClub([course],course.clubName),course);
 assert.equal(soleCourseAtClub([course,{...course,id:'other',name:'Second course'}],course.clubName),null);
});
