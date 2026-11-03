import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {buildSupabaseInstall} from '../scripts/supabase-install.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
test('session identifies a standalone platform administrator without inventing memberships, and revocation removes access',async()=>{
 const db=await PGlite.create({extensions:{pgcrypto,btree_gist}});
 try{
  await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as 'select null::uuid';create function auth.jwt() returns jsonb language sql as 'select null::jsonb';");
  await db.exec(buildSupabaseInstall());
  const person=(await db.query("insert into person(first_name,last_name,email) values('Test','Administrator','admin@example.test') returning id")).rows[0].id;
  await db.query('insert into app_operator(person_id) values($1)',[person]);
  const api={},deps={
   '@/lib/server/db':{dbQuery:(...args)=>db.query(...args),withTransaction:fn=>db.transaction(fn)},
   '@/lib/server/appearance':{loadAppearanceConfig:async()=>({})},
   '@/lib/server/adverts':{loadSponsorAdverts:async()=>[]},
   '@/lib/server/role-view':{},'@/lib/server/mobile-auth':{},'@/lib/server/tokens':{},'next/headers':{}
  };
  new Function('require','exports',ts.transpileModule(readFileSync('lib/server/auth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(name=>deps[name]??require(name),api);
  const user={accountId:'test-account',personId:person,name:'Test Administrator',email:'admin@example.test',username:'testadmin',profileImage:''};
  const session=await api.loadSessionPayload(user);
  assert.equal(session.authenticated,true);assert.equal(session.platformAdmin,true);assert.deepEqual(session.contexts,[]);
  assert.equal((await db.query('select count(*)::int as n from club_membership')).rows[0].n,0);
  await db.query('update app_operator set active=false where person_id=$1',[person]);
  assert.equal((await api.loadSessionPayload(user)).platformAdmin,false);
  await db.query('delete from app_operator where person_id=$1',[person]);
  assert.equal((await api.loadSessionPayload(user)).platformAdmin,false);
 }finally{await db.close();}
});
