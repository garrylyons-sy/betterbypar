import test from 'node:test';
import assert from 'node:assert/strict';
import {localDemoEnabled,localDemoAccounts} from '../lib/local-demo.mjs';
test('local demo entry is unavailable without an explicit development flag',()=>{
 assert.equal(localDemoEnabled({NODE_ENV:'development',LOCAL_DEMO:'1'}),true);
 assert.equal(localDemoEnabled({NODE_ENV:'production',LOCAL_DEMO:'1'}),false);
 assert.equal(localDemoEnabled({NODE_ENV:'development'}),false);
 assert.equal(localDemoEnabled({LOCAL_DEMO:'1'}),false);
});
test('demo identities use fictional addresses and explicit roles',()=>{
 assert.ok(localDemoAccounts.length>=6);
 assert.equal(new Set(localDemoAccounts.map(a=>a.email)).size,localDemoAccounts.length);
 assert.ok(localDemoAccounts.every(a=>a.email.endsWith('@example.test')));
 assert.ok(localDemoAccounts.some(a=>a.role==='Golf Professional'));
 assert.ok(localDemoAccounts.some(a=>a.role==='Club Admin'));
});

test('local demo overrides production connections and external delivery credentials',async()=>{
 const {localDemoEnvironment}=await import('../lib/local-demo.mjs');
 const env=localDemoEnvironment({DATABASE_URL:'postgresql://remote.example/live',RESEND_API_KEY:'live-key',GOOGLE_CLIENT_SECRET:'live-secret',VAPID_PRIVATE_KEY:'live-key',GOLF_IRELAND_CLUB_CREDENTIALS:'live-credentials',GOLF_IRELAND_MEMBER_UIDS:'live-identifiers',GOLF_IRELAND_DATA_MODE:'live'});
 assert.equal(env.DATABASE_URL,'postgresql://postgres:postgres@127.0.0.1:55432/postgres');
 assert.equal(env.RESEND_API_KEY,'');assert.equal(env.GOOGLE_CLIENT_SECRET,'');assert.equal(env.VAPID_PRIVATE_KEY,'');
 assert.equal(env.GOLF_IRELAND_CLUB_CREDENTIALS,'');assert.equal(env.GOLF_IRELAND_MEMBER_UIDS,'');assert.equal(env.GOLF_IRELAND_DATA_MODE,'demo');
 assert.equal(env.LOCAL_DEMO,'1');assert.equal(env.NODE_ENV,'development');
});
test('local seed is complete, fictional and idempotent',async()=>{
 const [{PGlite},{btree_gist},{pgcrypto},{initializeLocalDemo}]=await Promise.all([import('@electric-sql/pglite'),import('@electric-sql/pglite/contrib/btree_gist'),import('@electric-sql/pglite/contrib/pgcrypto'),import('../scripts/local-demo-database.mjs')]);
 const db=await PGlite.create({extensions:{btree_gist,pgcrypto}});
 try{
  await initializeLocalDemo(db);await initializeLocalDemo(db);
  assert.equal((await db.query('select count(*)::int as n from public.person')).rows[0].n,7);
  assert.equal((await db.query('select count(*)::int as n from public.club')).rows[0].n,2);
  assert.equal((await db.query('select count(*)::int as n from public.dependants where active')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int as n from public.lesson_slot where active')).rows[0].n,9);
  await db.exec("update public.lesson_slot set starts_at=starts_at-interval '14 days',ends_at=ends_at-interval '14 days'");
  await initializeLocalDemo(db);
  assert.equal((await db.query('select count(*)::int as n from public.lesson_slot where starts_at>now()')).rows[0].n,9);
  assert.equal((await db.query("select count(*)::int n from club where name='Castle Golf Club'")).rows[0].n,1);
  assert.equal((await db.query("select first_name||' '||last_name as name from person where email='professional@example.test'")).rows[0].name,'Colin Clancy');
  assert.equal((await db.query("select first_name||' '||last_name as name from person where email='assistant@example.test'")).rows[0].name,'Shane Comer');
  const accounts=(await db.query('select p.email from public.user_account ua join public.person p on p.id=ua.person_id')).rows;
  assert.equal(accounts.length,6);assert.ok(accounts.every(a=>a.email.endsWith('@example.test')));
 }finally{await db.close();}
});
