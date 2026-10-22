import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function harness(user={personId:'real-user'},allowed=true){
 const calls=[];class LiveStreamError extends Error{constructor(message,status){super(message);this.status=status;}}
 const exports={};const service={LiveStreamError};
 for(const name of ['listLiveStreams','listPublisherFixtures','makeFixtureLive','endLiveStream'])service[name]=async(...args)=>{calls.push([name,...args]);if(!allowed)throw new LiveStreamError('Access required.',403);return name==='listPublisherFixtures'?{items:[],page:1,hasMore:false}:{streams:[],canPublish:false,canView:true};};
 const deps={'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200,headers:options.headers})}},'@/lib/server/auth':{currentUser:async()=>user},'@/lib/server/livestreams':service};
 const code=ts.transpileModule(fs.readFileSync(new URL('../app/api/livestreams/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','exports',code)(name=>deps[name],exports);return {api:exports,calls};
}
const request=(body)=>new Request('https://app.test/api/livestreams?testUser=admin',{method:'POST',body:JSON.stringify(body)});
test('anonymous livestream API requests cannot fetch listings, match options or publish',async()=>{
 const {api,calls}=harness(null);
 for(const url of ['','?view=fixtures'])assert.equal((await api.GET(new Request('https://app.test/api/livestreams'+url))).status,401);
 assert.equal((await api.POST(request({action:'make-live'}))).status,401);assert.equal(calls.length,0);
});
test('API binds reads and writes to signed-in identity and returns private uncached responses',async()=>{
 const {api,calls}=harness();const result=await api.GET(new Request('https://app.test/api/livestreams'));
 assert.match(result.headers['Cache-Control'],/no-store/);
 await api.GET(new Request('https://app.test/api/livestreams?view=fixtures&q=Club&page=2'));
 await api.POST(request({action:'make-live',personId:'spoof',fixtureId:'fixture',youtubeUrl:'url'}));
 await api.POST(request({action:'end',personId:'spoof',id:'stream'}));
 assert.equal(calls[0][1],'real-user');assert.deepEqual(calls[1],['listPublisherFixtures','real-user','Club','2']);
 assert.equal(calls[2][1],'real-user');assert.equal(calls[3][1],'real-user');assert.equal(calls[3][2],'stream');
});
test('denied viewers and invalid requests return controlled errors',async()=>{
 const {api}=harness(undefined,false);assert.equal((await api.GET(new Request('https://app.test/api/livestreams'))).status,403);
 assert.equal((await api.POST(request({action:'end',id:'x'}))).status,403);
 assert.equal((await api.POST(request(null))).status,400);assert.equal((await api.POST(request({action:'delete-all'}))).status,400);
 assert.equal((await api.POST(new Request('https://app.test/api/livestreams',{method:'POST',body:'bad'}))).status,400);
});
