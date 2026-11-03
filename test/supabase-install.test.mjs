import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {buildSupabaseInstall,supabaseInstallFiles} from '../scripts/supabase-install.mjs';
import {supabaseConnectionTarget} from '../scripts/check-supabase.mjs';
test('Supabase target validation accepts session poolers and rejects local, API and unrelated databases',()=>{
 assert.deepEqual(supabaseConnectionTarget('postgresql://postgres.myproject:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'),{host:'aws-0-eu-west-1.pooler.supabase.com',reference:'myproject'});
 assert.equal(supabaseConnectionTarget('postgresql://postgres:secret@db.myproject.supabase.co:5432/postgres').reference,'myproject');
 for(const value of ['', 'https://myproject.supabase.co','postgresql://postgres:secret@127.0.0.1:55432/postgres','postgresql://postgres:secret@db.unrelated.com/postgres','postgresql://postgres.myproject:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres'])assert.throws(()=>supabaseConnectionTarget(value));
});
test('complete clean installation has golf features and course references without demo people or clubs',async()=>{
 const db=await PGlite.create({extensions:{pgcrypto,btree_gist}});
 try{
  await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as 'select null::uuid';create function auth.jwt() returns jsonb language sql as 'select null::jsonb';");
  const sql=buildSupabaseInstall();assert.equal(supabaseInstallFiles.length,22);await db.exec(sql);
  for(const table of ['person','club','user_account','app_operator'])assert.equal((await db.query(`select count(*)::int as n from ${table}`)).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int as n from golf_course')).rows[0].n,5);
  assert.equal((await db.query('select count(*)::int as n from golf_course_tee')).rows[0].n,17);
  for(const table of ['mobile_session','golf_round','golf_round_comment','golf_practice_assignment','lesson_group','dependants'])assert.ok((await db.query('select to_regclass($1) as name',[table])).rows[0].name);
  await assert.rejects(db.exec(sql),/requires an empty/);
  assert.equal((await db.query('select count(*)::int as n from golf_course')).rows[0].n,5);
 }finally{await db.close();}
});

test('clean installer refuses an unrelated populated public schema before creating anything',async()=>{
 const db=await PGlite.create();try{
  await db.exec('create table existing_data(id integer);insert into existing_data values(42);');
  await assert.rejects(db.exec(buildSupabaseInstall()),/requires an empty/);
  assert.equal((await db.query('select id from existing_data')).rows[0].id,42);
  assert.equal((await db.query("select to_regclass('public.person') as name")).rows[0].name,null);
 }finally{await db.close();}
});
