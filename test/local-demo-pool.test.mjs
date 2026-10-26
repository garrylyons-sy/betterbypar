import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync('lib/server/db.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
test('local demo serializes database connections and reuses its pool across module reloads',()=>{
 const created=[];const context=vm.createContext({exports:{},process:{env:{LOCAL_DEMO:'1',NODE_ENV:'development',DATABASE_URL:'postgresql://localhost:55432/demo'}},require:()=>({Pool:class{constructor(options){this.options=options;created.push(this);}}})});
 vm.runInContext(`(function(){${source}})()`,context);const first=context.exports.getPool();assert.equal(first.options.max,1);
 context.exports={};vm.runInContext(`(function(){${source}})()`,context);assert.equal(context.exports.getPool(),first);assert.equal(created.length,1);
});
test('normal Postgres configuration retains its regular connection pool',()=>{
 const context=vm.createContext({exports:{},process:{env:{NODE_ENV:'production',DATABASE_URL:'postgresql://database/app'}},require:()=>({Pool:class{constructor(options){this.options=options;}}})});
 vm.runInContext(`(function(){${source}})()`,context);assert.equal(context.exports.getPool().options.max,undefined);
});
