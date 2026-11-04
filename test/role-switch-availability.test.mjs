import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import {canSwitchRoleView,roleViewRolesForClub} from '../shared/admin-role-view.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
test('administrator context alone has no alternative role and unavailable roles are excluded',()=>{
 assert.equal(canSwitchRoleView([]),false);assert.equal(canSwitchRoleView([{role:'unknown'}]),false);
 const people=[{clubId:'castle',role:'Player'},{clubId:'castle',role:'Player'},{clubId:'grange',role:'Golf Professional'}];
 assert.deepEqual(roleViewRolesForClub(people,'castle'),['Player']);assert.deepEqual(roleViewRolesForClub(people,'missing'),[]);
 assert.equal(canSwitchRoleView(people),true); // Admin plus its authorised working roles.
});
test('single-role switch requests are rejected before signing, impersonation or audit writes',async()=>{
 const api={},deps={'next/server':{NextResponse:{json:(body,options)=>({body,status:options.status})}},'next/headers':{},'@/lib/server/auth':{authenticatedUser:async()=>({personId:'admin'})},'@/lib/server/role-view':{roleViewOptions:async()=>({canSwitchRole:false,clubs:[],people:[]})},'@/lib/server/role-view-token.mjs':{signRoleView:()=>{throw Error('Must not sign');}},'@/shared/admin-role-view.mjs':{roleViewSameOrigin:()=>true},'@/lib/server/db':{dbQuery:()=>{throw Error('Must not write');}}};
 new Function('require','exports',ts.transpileModule(readFileSync('app/api/admin/role-view/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(id=>deps[id],api);
 const result=await api.POST(new Request('https://www.betterbypar.com/api/admin/role-view',{method:'POST',body:JSON.stringify({role:'Player'})}));assert.equal(result.status,403);assert.match(result.body.error,/only one available role/);
});
