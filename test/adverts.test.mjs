import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),ts=require('typescript');
function load(path,deps){const api={};new Function('require','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name in deps?deps[name]:require(name),api);return api;}
test('testUser email cannot authenticate advert reads or clicks or write forged analytics',async()=>{
 let reads=0,writes=0;
 const deps={'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status??200})}},'@/lib/server/auth':{currentUser:async()=>null,currentUserFromRequest:async()=>({personId:'legacy-chair'})},'@/lib/server/adverts':{loadSponsorAdverts:async()=>{reads++;return [];},eligibleAdvertSql:'true'},'@/lib/server/db':{dbQuery:async()=>{writes++;return {rows:[{person_id:'legacy-chair'}]};}}};
 const api=load('app/api/adverts/route.ts',deps),click=load('app/api/ad-click/route.ts',deps);
 const suffix='?testUser=chair%40notrealmail.com';
 assert.equal((await api.GET(new Request('https://app.test/api/adverts'+suffix))).status,401);
 assert.equal((await click.POST(new Request('https://app.test/api/ad-click'+suffix,{method:'POST',body:JSON.stringify({adId:'forged',adName:'Forged analytics'})}))).status,401);
 assert.equal(reads,0);assert.equal(writes,0);
});
test('advert URLs allow web destinations and bounded raster images, rejecting executable or ambiguous URLs',async()=>{
 const p=await import('../shared/advert-policy.mjs');
 for(const value of ['https://example.com/offer','http://example.com'])assert.equal(p.safeAdvertLink(value),value);
 for(const value of ['javascript:alert(1)','https://','https://user:pass@example.com','//evil.test','https://example.com\\@evil.test'])assert.equal(p.safeAdvertLink(value),null);
 for(const value of ['/uploads/banner.png','https://example.com/banner.png','data:image/png;base64,aGVsbG8='])assert.equal(p.safeAdvertImage(value),value);
 for(const value of ['//evil.test/banner','/\\evil.test','data:image/svg+xml;base64,PHN2Zz4=','javascript:alert(1)','data:image/png;base64,'+'a'.repeat(6_000_000)])assert.equal(p.safeAdvertImage(value),null);
 assert.equal(p.advertImageUrl('/uploads/banner.png','https://app.test'),'https://app.test/uploads/banner.png');
});
test('actual advert API and click SQL enforce schedule, active membership audience and authoritative campaign metadata',async()=>{
 const db=await PGlite.create();let actor='member';
 try{
  await db.exec(`create table club(id text primary key,active boolean);create table club_membership(person_id text,club_id text,role text,active boolean);
   create table ads(id text primary key,name text,placement text,audience text,image_path text,link_url text,affiliate_code text,alt_text text,active boolean,sort_order int,starts_at timestamptz,ends_at timestamptz);
   create table user_activity_log(person_id text,activity_type text,page_path text,page_label text,user_agent text,metadata jsonb);
   insert into club values('club',true);insert into club_membership values('chair','club','League Chair',true),('inactive','club','League Chair',false);
   insert into ads values('everyone','Public advert','league-chair-banner','Everyone','/banner.png','https://example.com/real',null,'Public advert',true,10,null,null);
   insert into ads select 'chair','Chair advert',placement,'League Chair',image_path,link_url,null,alt_text,true,1,null,null from ads where id='everyone';
   insert into ads select 'inactive','Inactive',placement,audience,image_path,link_url,null,alt_text,false,0,null,null from ads where id='everyone';
   insert into ads select 'future','Future',placement,audience,image_path,link_url,null,alt_text,true,0,now()+interval '1 day',null from ads where id='everyone';
   insert into ads select 'expired','Expired',placement,audience,image_path,link_url,null,alt_text,true,0,null,now()-interval '1 day' from ads where id='everyone';`);
  const policy=await import('../shared/advert-policy.mjs'),database={dbQuery:(...args)=>db.query(...args)};
  const adverts=load('lib/server/adverts.ts',{'@/lib/server/db':database,'@/shared/advert-policy.mjs':policy});
  const deps={'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status??200,headers:options?.headers})}},'@/lib/server/auth':{currentUser:async()=>actor?{personId:actor}:null},'@/lib/server/db':database,'@/lib/server/adverts':adverts};
  const api=load('app/api/adverts/route.ts',deps),click=load('app/api/ad-click/route.ts',deps);
  const get=()=>api.GET(new Request('https://app.test/api/adverts'));
  const post=id=>click.POST(new Request('https://app.test/api/ad-click',{method:'POST',headers:{'user-agent':'Advert test'},body:JSON.stringify({adId:id,adName:'forged',linkUrl:'https://evil.test'})}));
  assert.equal((await get()).body.adverts[0].id,'everyone');assert.equal((await get()).headers['Cache-Control'],'private, no-store');
  for(const id of ['missing','inactive','future','expired','chair'])assert.equal((await post(id)).status,404,id);
  assert.equal((await post('everyone')).body.recorded,true);
  const log=(await db.query('select * from user_activity_log')).rows[0];assert.equal(log.page_path,'https://example.com/real');assert.equal(log.metadata.ad_name,'Public advert');assert.equal(log.user_agent,'Advert test');
  actor='chair';assert.equal((await get()).body.adverts[0].id,'chair');assert.equal((await post('chair')).status,200);
  await db.query("update club set active=false");assert.equal((await get()).body.adverts[0].id,'everyone');assert.equal((await post('chair')).status,404);
  actor='inactive';assert.equal((await post('chair')).status,404);
  actor=null;assert.equal((await get()).status,401);assert.equal((await post('everyone')).status,401);
 }finally{await db.close();}
});
test('campaign administration validates images, destinations, audiences and schedule before writing',async()=>{
 const policy=await import('../shared/advert-policy.mjs');let writes=0,lastArgs=[];
 const row={id:'ad',name:'Sponsor',placement:'league-chair-banner',audience:'Everyone',image_path:'/banner.png',link_url:'https://example.com',affiliate_code:null,alt_text:'Banner',active:true,sort_order:1,starts_at:null,ends_at:null};
 const route=load('app/api/admin/adverts/route.ts',{'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status??200})}},'@/lib/server/auth':{currentUser:async()=>({personId:'operator'})},'@/lib/server/db':{dbQuery:async(sql,args)=>{if(sql.startsWith('select 1'))return {rowCount:1};if(!sql.startsWith('select')){writes++;lastArgs=args;}return {rows:[row],rowCount:1};}},'@/shared/advert-policy.mjs':policy,'@/lib/ads':load('lib/ads.ts',{})});
 const valid={name:'Sponsor',imagePath:'/banner.png',linkUrl:'https://example.com',audience:'Everyone',active:true};
 const post=body=>route.POST(new Request('https://app.test/api/admin/adverts',{method:'POST',body:JSON.stringify(body)}));
 for(const changes of [{imagePath:'data:image/svg+xml;base64,PHN2Zz4='},{linkUrl:'javascript:alert(1)'},{linkUrl:'https://'},{audience:'Professional'},{startsAt:'yesterday'},{startsAt:'2030-01-02',endsAt:'2030-01-01'},{active:'false'}])assert.equal((await post({...valid,...changes})).status,400);
 assert.equal(writes,0);assert.equal((await post(valid)).status,200);assert.equal(writes,1);
 row.starts_at='2030-01-01T00:00:00Z';row.ends_at='2030-02-01T00:00:00Z';
 assert.equal((await route.PATCH(new Request('https://app.test/api/admin/adverts',{method:'PATCH',body:JSON.stringify({...valid,id:'ad'})}))).status,200);
 assert.equal(lastArgs[9],row.starts_at);assert.equal(lastArgs[10],row.ends_at);
});
