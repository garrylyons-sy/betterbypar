import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
test('database pool is bounded and reused across development module reloads',async()=>{
 const original={DATABASE_URL:process.env.DATABASE_URL,LOCAL_DEMO:process.env.LOCAL_DEMO,NODE_ENV:process.env.NODE_ENV},old=globalThis.betterByParDatabasePool,created=[];
 class Pool{constructor(options){this.options=options;created.push(this);}async end(){this.ended=true;}}
 const load=()=>{const api={};new Function('require','exports',ts.transpileModule(readFileSync('lib/server/db.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(()=>({Pool}),api);return api;};
 try{
  delete globalThis.betterByParDatabasePool;
  process.env.NODE_ENV='development';process.env.LOCAL_DEMO='0';process.env.DATABASE_URL='postgresql://test:secret@db.example.test/postgres';
  const first=load().getPool();assert.equal(first.options.max,4);assert.equal(first.options.connectionTimeoutMillis,10000);
  assert.equal(load().getPool(),first);assert.equal(created.length,1);
  process.env.DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/postgres';process.env.LOCAL_DEMO='1';
  const demo=load().getPool();assert.notEqual(demo,first);assert.equal(first.ended,true);assert.equal(demo.options.max,1);assert.equal(demo.options.ssl,false);assert.equal(load().getPool(),demo);
 }finally{for(const [key,value]of Object.entries(original))if(value===undefined)delete process.env[key];else process.env[key]=value;if(old===undefined)delete globalThis.betterByParDatabasePool;else globalThis.betterByParDatabasePool=old;}
});
