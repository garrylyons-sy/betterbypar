import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';import {buildSupabaseInstall} from '../scripts/supabase-install.mjs';import {signRoleView,readRoleView} from '../lib/server/role-view-token.mjs';import {clubViewRoles} from '../shared/admin-role-view.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
test('role view requires a current operator and active target appointment, supports account-free coaches and rejects revocation',async()=>{const db=await PGlite.create({extensions:{pgcrypto,btree_gist}});try{
 await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as 'select null::uuid';create function auth.jwt() returns jsonb language sql as 'select null::jsonb';");await db.exec(buildSupabaseInstall());
 const actor=(await db.query("insert into person(first_name,last_name) values('Test','Admin') returning id")).rows[0].id;await db.query('insert into app_operator(person_id) values($1)',[actor]);
 const target=(await db.query("insert into person(first_name,last_name) values('Test','Professional') returning id")).rows[0].id;const club=(await db.query("insert into club(name,active) values('Test Club',false) returning id")).rows[0].id;await db.query("insert into club_membership(person_id,club_id,role) values($1,$2,'Golf Professional')",[target,club]);
 await db.query('insert into club_admin(person_id,club_id) values($1,$2)',[actor,club]);const backup=(await db.query("insert into person(first_name,last_name) values('Backup','Professional') returning id")).rows[0].id;await db.query("insert into club_membership(person_id,club_id,role) values($1,$2,'Golf Professional')",[backup,club]);await db.query('update club set active=true where id=$1',[club]);
 const api={},deps={'next/headers':{},'@/lib/server/db':{dbQuery:async(...args)=>{const result=await db.query(...args);return {...result,rowCount:result.rows.length};}},'./role-view-token.mjs':{readRoleView},'@/shared/admin-role-view.mjs':{clubViewRoles}};
 new Function('require','exports',ts.transpileModule(readFileSync('lib/server/role-view.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>deps[name]??require(name),api);
 const user={personId:actor,accountId:'original',name:'Test Admin',username:'test',email:'',profileImage:''};const token=signRoleView({personId:target,clubId:club,role:'Golf Professional'},'session');
 const effective=await api.resolveRoleView(user,'session',token);assert.equal(effective.personId,target);assert.equal(effective.accountId,'');assert.equal(effective.actingAs.actorPersonId,actor);
 await assert.rejects(()=>api.resolveRoleView({...user,personId:target},'session',token),/administrator/);
 await db.query('update club_membership set active=false where person_id=$1',[target]);await assert.rejects(()=>api.resolveRoleView(user,'session',token),/no longer active/);
 await db.query('update club_membership set active=true where person_id=$1',[target]);await db.query('update app_operator set active=false where person_id=$1',[actor]);await assert.rejects(()=>api.resolveRoleView(user,'session',token),/administrator/);
 }finally{await db.close();}});
test('lesson feedback and group mutations reject the wrong working club or role before any write',async()=>{
 const {roleViewScopeAllowed}=await import('../shared/admin-role-view.mjs');
 const load=(file,deps)=>{const api={};new Function('require','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>deps[name]??require(name),api);return api;};
 const guards=load('lib/server/golf-access.ts',{'@/lib/server/role-view':{},'@/shared/admin-role-view.mjs':{roleViewScopeAllowed},'@/lib/server/auth':{},'@/lib/server/db':{},'@/lib/golf-policy':{}});
 for(const view of [{clubId:'castle',role:'Golf Professional'},{clubId:'other',role:'Player'},{clubId:'other',role:'Club Admin'}]){
  const access={user:{personId:'coach',actingAs:view}};let writes=0;
  const deps={
   '@/lib/server/golf-access':{...guards,golfAccess:async()=>access},
   '@/lib/server/lesson-notifications':{},'@/lib/server/notification-dispatch':{},
   '@/lib/server/lesson-diary':{requireActiveCoach:async()=>{}},'@/lib/server/lesson-booking':{},
   '@/lib/lesson-diary.mjs':{lessonText:v=>String(v??'')},'@/lib/lesson-groups.mjs':{},
   'next/server':{NextResponse:{json:(data,options={})=>({data,status:options.status??200})}},
   '@/lib/server/db':{withTransaction:async fn=>fn({query:async sql=>{if(!sql.startsWith('select')){writes++;throw new Error('Unexpected write');}return {rows:[{id:'booking',club_id:'other',professional_person_id:'coach'}]};}})}
  };
  const feedback=load('app/api/admin/lesson-feedback/route.ts',deps);const req=body=>new Request('http://localhost/api',{method:'POST',body:JSON.stringify(body)});
  assert.equal((await feedback.PATCH(req({bookingId:'booking',feedback:'Feedback'}))).status,403);
  const groups=load('app/api/admin/lesson-groups/route.ts',deps);
  assert.equal((await groups.POST(req({action:'create',clubId:'other',name:'Group',mode:'Open'}))).status,403);
  assert.equal((await groups.POST(req({action:'session',groupId:'group'}))).status,403);
  assert.equal(writes,0);
 }
});
test('an expired original login can clear its working context without creating a new session',async()=>{
 const policy=await import('../shared/admin-role-view.mjs');let cleared=false;
 const deps={'next/server':{NextResponse:{json:(data,options={})=>({data,status:options.status??200})}},'next/headers':{cookies:async()=>({get:()=>({value:'expired-role-token'}),delete:()=>{cleared=true;}})},'@/lib/server/auth':{authenticatedUser:async()=>null},'@/lib/server/role-view':{roleViewCookie:'bbp_role_view'},'@/lib/server/role-view-token.mjs':{},'@/shared/admin-role-view.mjs':policy,'@/lib/server/db':{dbQuery:()=>{throw new Error('No database write permitted without a login');}}};
 const api={};new Function('require','exports',ts.transpileModule(readFileSync('app/api/admin/role-view/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>deps[name]??require(name),api);
 assert.equal((await api.GET()).data.expired,true);
 const result=await api.DELETE(new Request('https://www.betterbypar.com/api/admin/role-view',{method:'DELETE',headers:{origin:'https://www.betterbypar.com'}}));assert.equal(result.status,200);assert.equal(result.data.href,'/');assert.equal(cleared,true);
});
