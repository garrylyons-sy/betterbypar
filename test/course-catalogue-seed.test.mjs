import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {courseSeedSql} from '../scripts/generate-course-seed.mjs';
const catalogue=JSON.parse(readFileSync('data/golf-course-catalogue.json','utf8'));
const sql=readFileSync('supabase/golf_course_catalogue_seed.sql','utf8');
test('starter scorecards have complete, internally consistent tee-specific hole data',()=>{
 assert.equal(courseSeedSql(catalogue),sql);
 assert.deepEqual([...new Set(catalogue.courses.map(c=>c.clubName))].sort(),['Castle Golf Club','Grange Golf Club','Milltown Golf Club']);
 assert.equal(catalogue.courses.length,5);
 for(const c of catalogue.courses)for(const t of c.tees){
  assert.deepEqual(t.holes.map(h=>h.number),Array.from({length:18},(_,i)=>i+1));
  assert.deepEqual(t.holes.map(h=>h.strokeIndex).sort((a,b)=>a-b),Array.from({length:18},(_,i)=>i+1));
  assert.equal(t.par,t.holes.reduce((n,h)=>n+h.par,0));
  assert.equal(t.totalDistance,t.holes.reduce((n,h)=>n+h.distance,0));
 }
 assert.equal(catalogue.courses.find(c=>c.slug==='grange-sheahan').tees.find(t=>t.slug==='red-women').par,74);
 assert.ok(catalogue.courses.find(c=>c.slug==='grange-academy').tees.every(t=>t.courseRating===null&&t.slopeRating===null));
});
test('database seed is repeatable and preserves existing edited course, tee and hole records',async()=>{
 const db=await PGlite.create();try{
  await db.exec('create role anon; create role authenticated;');
  await db.exec(readFileSync('supabase/golf_course_catalogue.sql','utf8'));await db.exec(sql);
  assert.equal((await db.query('select count(*)::int as n from golf_course')).rows[0].n,5);
  assert.equal((await db.query('select count(*)::int as n from golf_course_tee')).rows[0].n,17);
  assert.equal((await db.query('select count(*)::int as n from golf_course_hole')).rows[0].n,306);
  await db.exec("update golf_course set location='Club verified'; update golf_course_tee set course_rating=70; update golf_course_hole set distance=250;");
  await db.exec(sql);
  assert.equal((await db.query('select count(*)::int as n from golf_course_hole')).rows[0].n,306);
  assert.ok((await db.query('select location from golf_course')).rows.every(c=>c.location==='Club verified'));
  assert.ok((await db.query('select course_rating from golf_course_tee')).rows.every(t=>Number(t.course_rating)===70));
  assert.ok((await db.query('select distance from golf_course_hole')).rows.every(h=>h.distance===250));
 }finally{await db.close();}
});
