import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
test('a listing that ended or disappeared before the notification lock creates no fanout',async()=>{
 const exports={};const compiled=ts.transpileModule(fs.readFileSync(new URL('../lib/server/livestream-notifications.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','exports',compiled)(()=>({}),exports);
 const calls=[];assert.deepEqual(await exports.notifyLivestreamViewers({query:async sql=>{calls.push(sql);return {rows:[]};}},'ended'),{count:0,alreadyNotified:false});
 assert.equal(calls.length,1);assert.match(calls[0],/for update of ls/i);
});
