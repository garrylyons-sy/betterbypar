import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as policy from '../lib/livestream-policy.mjs';
function service(){
 const calls=[];const fixtures=Array.from({length:11},(_,index)=>({id:`fixture-${index}`,homeTeam:'Home',awayTeam:'Away',fixtureDate:'2026-10-22',competition:'A League',status:'Scheduled'}));
 const deps={'@/lib/livestream-policy.mjs':policy,'@/lib/server/db':{dbQuery:async(sql,params)=>{if(sql.includes('as "canBroadcast"'))return {rows:[{canBroadcast:true,canView:false}]};calls.push({sql,params});return {rows:fixtures};}}};
 const code=ts.transpileModule(fs.readFileSync(new URL('../lib/server/livestreams.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};new Function('require','exports',code)(name=>deps[name],exports);return {api:exports,calls};
}
test('match picker returns ten choices with a continuation flag and advances by ten on Load more',async()=>{
 const {api,calls}=service();const first=await api.listVideoFixtures('publisher','Club','1');
 assert.equal(first.items.length,10);assert.equal(first.hasMore,true);
 assert.equal(first.items[0].id,'fixture-0');assert.equal(first.items.at(-1).id,'fixture-9');
 await api.listVideoFixtures('publisher','Club','2');assert.deepEqual(calls[1].params,['Club',10]);
});
