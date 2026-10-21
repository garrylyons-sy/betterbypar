// Checks live privileges and real server queries. Test writes are rolled back;
// no checkout email, payment or other external action is invoked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import ts from 'typescript';

const require=createRequire(import.meta.url);
for(const file of ['.env.local','.env'])if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
 const match=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
 if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^["']|["']$/g,'');
}
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
const client=await pool.connect();
const tables=['ads','product','shop_order','shop_order_item'];
try{
 await client.query('begin');
 await client.query("set local statement_timeout='30s'");
 const unprotected=await client.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity");
 assert.deepEqual(unprotected.rows,[],'Public tables must have RLS enabled');
 for(const role of ['anon','authenticated']){
  for(const table of tables){
   for(const privilege of ['select','insert','update','delete','truncate','references','trigger']){
    const permission=await client.query('select has_table_privilege($1,$2,$3) as allowed',[role,`public.${table}`,privilege]);
    assert.equal(permission.rows[0].allowed,false,`${role} has ${privilege} on ${table}`);
   }
  }
  // Exercise permission enforcement, rather than relying on metadata alone.
  for(const table of tables)for(const sql of [`select * from public.${table} limit 0`,`insert into public.${table} default values`,`update public.${table} set id=id where false`,`delete from public.${table} where false`]){
   await client.query('savepoint denied_access');
   await client.query(`set local role ${role}`);
   await assert.rejects(client.query(sql),error=>error.code==='42501',`${role}: ${sql}`);
   await client.query('rollback to savepoint denied_access');
   await client.query('release savepoint denied_access');
  }
 }
 const db={dbQuery:(sql,args)=>client.query(sql,args),withTransaction:fn=>fn(client)};
 const cache=new Map();
 function load(name){
  if(cache.has(name))return cache.get(name);
  const exports={};cache.set(name,exports);
  const compiled=ts.transpileModule(fs.readFileSync(new URL(`../${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports',compiled)(dependency=>dependency==='@/lib/server/db'?db:dependency==='next/headers'?{cookies:()=>{throw Error('No browser session in SQL verification');}}:dependency.startsWith('@/')?load(dependency.slice(2)):require(dependency),exports);
  return exports;
 }
 const user=(await client.query(`select ua.id as "accountId",p.id as "personId",ua.username,coalesce(p.email,'') as email,p.first_name||' '||p.last_name as name,'' as "profileImage" from public.user_account ua join public.person p on p.id=ua.person_id where ua.active and p.active and exists(select 1 from public.club_membership cm where cm.person_id=p.id and cm.active and cm.role='League Chair') limit 1`)).rows[0];
 assert.ok(user,'Need an active League Chair for the server-route check');
 const auth=load('lib/server/auth');
 const session=await auth.loadSessionPayload(user);
 assert.equal(session.authenticated,true);
 assert.ok(Array.isArray(session.sponsorAds),'Session must include advert data');

 const product=(await client.query("insert into public.product(product_name,description,image_path,price_euros) values($1,'Security verification','/icons/icon-192.png',1) returning id",[`Security verification ${randomUUID()}`])).rows[0];
 const ad=(await client.query("insert into public.ads(name,placement,audience,image_path,link_url) values($1,'league-chair-banner','Everyone','/icons/icon-192.png','https://example.com') returning id",[`Security verification ${randomUUID()}`])).rows[0];
 await client.query('update public.ads set alt_text=$2 where id=$1',[ad.id,'Security verification']);
 assert.equal((await client.query('select id from public.ads where id=$1',[ad.id])).rowCount,1);

 // Run the actual shop route against the live DB connection, supplying only
 // the verified identity at the request-auth boundary, without creating a session.
 const source=ts.transpileModule(fs.readFileSync(new URL('../app/api/shop/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const shop={};
 new Function('require','exports',source)(name=>name==='@/lib/server/auth'?{currentUserFromRequest:async()=>user}:name==='@/lib/server/db'?db:require(name),shop);
 const catalogue=await shop.GET(new Request('https://app.test/api/shop'));
 assert.equal(catalogue.status,200);
 assert.ok((await catalogue.json()).products.some(item=>item.id===product.id));
 const checkout=await shop.POST(new Request('https://app.test/api/shop',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({buyerName:'Security verification',buyerEmail:'verification@example.invalid',items:[{productId:product.id,quantity:1}]})}));
 assert.equal(checkout.status,200);
 const {order}=await checkout.json();
 assert.equal(order.totalEuros,1);
 assert.equal((await client.query('select id from public.shop_order_item where order_id=$1',[order.id])).rowCount,1);
 await client.query('delete from public.shop_order_item where order_id=$1',[order.id]);
 await client.query('delete from public.shop_order where id=$1',[order.id]);
 await client.query('delete from public.product where id=$1',[product.id]);
 await client.query('delete from public.ads where id=$1',[ad.id]);
 console.log('Verified: all public tables have RLS; anon/authenticated cannot read or write adverts or shop tables; app session and adverts load; shop catalogue and checkout work. All test writes rolled back.');
}finally{
 await client.query('rollback');
 client.release();
 await pool.end();
}
