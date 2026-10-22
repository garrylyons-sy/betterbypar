import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
import * as policy from '../lib/notification-policy.mjs';
const require=createRequire(import.meta.url);
test('Viewing-only push test queues a deliverable scoped livestream test rather than an ineligible announcement',async()=>{
 const calls=[];const config={...policy.defaultNotificationConfig,quietStart:'00:00',quietEnd:'00:00'},preferences={...policy.defaultNotificationPreferences,pushEnabled:true,pushTypes:['announcement']};
 const deps={'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},'@/lib/server/auth':{currentUser:async()=>({personId:'viewer'})},'@/lib/server/notification-dispatch':{scheduleNotificationPush(){}},'@/lib/server/notification-push':{pushReadiness:()=>({ready:true})},'@/lib/server/notifications':{notificationAccess:async()=>({eligible:true,roles:['Viewing'],config,preferences})},'@/lib/notification-policy.mjs':policy,'@/lib/server/db':{withTransaction:fn=>fn({query:async(sql,args)=>{calls.push({sql,args});return {rows:sql.includes('select id from public.notification_push_subscription')?[{id:'device'}]:[],rowCount:sql.includes('select id from public.notification_push_subscription')?1:0};}})}};
 const compiled=ts.transpileModule(fs.readFileSync(new URL('../app/api/notifications/push/test/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,exports={};
 new Function('require','exports',compiled)(name=>deps[name]??require(name),exports);
 assert.equal((await exports.POST()).status,200);
 const insert=calls.find(c=>c.sql.includes('insert into public.app_notification'));assert.equal(insert.args[2],'livestream');
 assert.equal(policy.canDeliverPush({type:insert.args[2]},preferences,config,['Viewing']),true);
});
