import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';import {initializeLocalDemo} from '../scripts/local-demo-database.mjs';import * as presentation from '../shared/lesson-presentation.mjs';
const require=createRequire(import.meta.url),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file,deps){const exports={};new Function('require','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(id=>deps[id]??require(id),exports);return exports;}
test('home lesson card shows a direct booking link, Dublin time and dependant name; hides cancelled and past lessons',()=>{
 const {UpcomingLessonCards}=load('components/upcoming-lesson-panel.tsx',{'next/link':{default:({children,...props})=>React.createElement('a',props,children)},'@/components/club-theme-provider':{useClubTheme:()=>({clubs:[]})},'@/shared/lesson-presentation.mjs':presentation});
 const booking={id:'booking',club_id:'club',title:'Putting lesson',player_person_id:'junior',player_name:'Casey Parker',professional_name:'Colin Clancy',status:'Booked',starts_at:'2031-06-03T09:00:00Z',ends_at:'2031-06-03T09:30:00Z'};
 const render=bookings=>renderToStaticMarkup(React.createElement(UpcomingLessonCards,{data:{actorId:'parent',bookings,total:bookings.length},now:Date.parse('2031-06-02T23:30:00Z')}));
 const html=render([booking]);assert.match(html,/Today/);assert.match(html,/10:00/);assert.match(html,/Colin Clancy · Casey Parker/);assert.match(html,/\/lessons\?booking=booking&amp;clubId=club#booking-booking/);assert.match(html,/View lesson/);
 assert.equal(render([{...booking,status:'Cancelled'}]),'');assert.equal(render([{...booking,ends_at:'2031-06-01T09:30Z'}]),'');
});
test('upcoming endpoint only returns own or authorized dependant bookings in the active club, with no availability side effects',async()=>{
 const db=await PGlite.create({extensions:{pgcrypto,btree_gist}});
 try{await initializeLocalDemo(db);const query=async(...args)=>{const r=await db.query(...args);return {...r,rowCount:r.rows.length};};
 const people=Object.fromEntries((await query('select email,id from person')).rows.map(p=>[p.email,p.id]));const club=(await query("select id from club where name='Castle Golf Club'")).rows[0].id,pro=people['professional@example.test'],member=people['member@example.test'],parent=people['parent@example.test'],junior=(await query("select id from person where first_name='Casey' and last_name='Parker'")).rows[0].id;
 let actor=member;class AccessError extends Error{}
 const {GET}=load('app/api/lessons/upcoming/route.ts',{'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status??200,headers:options?.headers})}},'@/lib/server/db':{dbQuery:query},'@/lib/server/golf-access':{AccessError,golfAccess:async()=>({user:{personId:actor},assignments:(await query('select club_id from club_membership where person_id=$1 and active',[actor])).rows.map(r=>({clubId:r.club_id}))}),golfError:e=>({error:e.message,status:e instanceof AccessError?403:400})}});
 const create=async(player,hour)=>{const s=await query("insert into lesson_slot(club_id,professional_person_id,title,created_by,starts_at,ends_at) values($1,$2,'Golf lesson',$2,$3::timestamptz,$3::timestamptz+interval '30 minutes') returning id",[club,pro,`2035-06-04T${hour}:00:00Z`]);return (await query('insert into lesson_booking(slot_id,player_person_id,booked_by,starts_at,ends_at) select id,$2,$2,starts_at,ends_at from lesson_slot where id=$1 returning id',[s.rows[0].id,player])).rows[0].id;};
 const own=await create(member,'09'),child=await create(junior,'10');const get=()=>GET(new Request(`http://localhost/api/lessons/upcoming?clubId=${club}`));
 let r=await get();assert.equal(r.status,200);assert.deepEqual(r.body.bookings.map(b=>b.id),[own]);assert.equal(r.body.total,1);assert.equal(r.headers['Cache-Control'],'private, no-store');
 actor=parent;r=await get();assert.deepEqual(r.body.bookings.map(b=>b.id),[child]);await query('update dependants set active=false where guardian_person_id=$1',[parent]);assert.equal((await get()).body.total,0);
 actor=member;await query('update lesson_slot set active=false where id=(select slot_id from lesson_booking where id=$1)',[own]);assert.equal((await get()).body.total,0);await query('update lesson_slot set active=true where id=(select slot_id from lesson_booking where id=$1)',[own]);
 await query("update lesson_booking set status='Cancelled' where id=$1",[own]);assert.equal((await get()).body.total,0);
 assert.equal((await GET(new Request('http://localhost/api/lessons/upcoming?clubId=unrelated'))).status,403);
 await query('update club_membership set active=false where person_id=$1',[member]);assert.equal((await get()).status,403);
 }finally{await db.close();}
});
