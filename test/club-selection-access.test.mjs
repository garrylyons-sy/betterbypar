import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';import {initializeLocalDemo} from '../scripts/local-demo-database.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
function load(path,deps){const api={};new Function('require','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>deps[id]??require(id),api);return api;}
test('club appearance switching and branding writes require active administrator appointments',async()=>{
 const db=await PGlite.create({extensions:{btree_gist,pgcrypto}});
 try{
  await initializeLocalDemo(db);
  const {clubSelectionAccess}=load('lib/server/club-selection.ts',{'@/lib/server/db':{dbQuery:(...args)=>db.query(...args)}});
  const {saveClubBranding}=load('lib/server/club-branding-store.ts',{});
  const users=(await db.query(`select p.id,cm.club_id,cm.role from person p join club_membership cm on cm.person_id=p.id where cm.active and cm.role in ('Club Member','Golf Professional','Assistant Professional') and not cm.is_club_admin and not exists(select 1 from club_admin a where a.person_id=p.id and a.active) and not exists(select 1 from app_operator o where o.person_id=p.id and o.active)`)).rows;
  assert.ok(users.some(u=>u.role==='Club Member'));assert.ok(users.some(u=>u.role==='Golf Professional'));assert.ok(users.some(u=>u.role==='Assistant Professional'));
  for(const u of users){assert.equal((await clubSelectionAccess({personId:u.id})).canSwitchClub,false);await assert.rejects(saveClubBranding(db,u.id,u.club_id,{logoPath:null,primaryColor:'#123456',accentColor:'#abcdef'}),e=>e.status===403);}
  const player=users.find(u=>u.role==='Club Member');
  await db.query('update club_membership set is_club_admin=true where person_id=$1 and club_id=$2',[player.id,player.club_id]);
  assert.equal((await clubSelectionAccess({personId:player.id})).canSwitchClub,true);
  await db.query('update club_membership set is_club_admin=false where person_id=$1',[player.id]);
  assert.equal((await clubSelectionAccess({personId:player.id})).canSwitchClub,false);
  assert.deepEqual(await clubSelectionAccess({personId:player.id,actingAs:{role:'Player',clubId:player.club_id}}),{canSwitchClub:false,defaultClubId:player.club_id});
 }finally{await db.close();}
});
