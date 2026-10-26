import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHmac} from 'node:crypto';
const require=createRequire(import.meta.url),ts=require('typescript');
const compiled=ts.transpileModule(readFileSync('lib/server/golf-ireland-isv.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function setup(name,record={handicap:{index:12.2,displayIndex:'12.2'},scores:[]}){
 const api={};new Function('require','exports',compiled)(require,api);
 const request={clubId:'local-club',clubName:'Selected Club',playerId:'local-person',playerName:'Pat Player',golfIrelandNumber:'1234567'};
 const uid='10000000-0000-4000-8000-000000000001',secret='SECRET signing key',username=`private-${name}@example.test`,calls=[];
 const env={GOLF_IRELAND_CLUB_CREDENTIALS:JSON.stringify({'local-club':{username,secretKey:secret}}),GOLF_IRELAND_MEMBER_UIDS:JSON.stringify({'local-club':{'1234567':uid}})};
 const fetcher=async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>url.endsWith('/account/token')?{accessToken:'PRIVATE_ACCESS',refreshToken:'PRIVATE_REFRESH',expiresAtUTC:'2031-01-01T01:00:00Z'}:record};};
 const get=(options={})=>api.getLiveGolfSummary(request,{env,fetcher,now:new Date('2031-01-01T00:00:00Z'),...options});
 return {get,request,env,fetcher,calls,uid,secret,username};
}
test('official authentication signs HS256 claims and reads only the explicitly mapped member',async()=>{
 const s=setup('auth');const result=await s.get();
 assert.equal(s.calls.length,2);
 const auth=s.calls[0],score=s.calls[1],jwt=JSON.parse(auth.init.body).clientToken,[header,claims,signature]=jwt.split('.');
 assert.deepEqual(JSON.parse(Buffer.from(header,'base64url')),{alg:'HS256',typ:'JWT'});
 assert.deepEqual(JSON.parse(Buffer.from(claims,'base64url')),{aud:'isv-api',iss:s.username,iat:1924992000});
 assert.equal(signature,createHmac('sha256',s.secret).update(`${header}.${claims}`).digest('base64url'));
 assert.equal(auth.url,'https://isvapi.clubhouse.golfireland.ie/api/ie/v1/account/token');assert.equal(auth.init.method,'POST');
 assert.equal(score.url,`https://isvapi.clubhouse.golfireland.ie/api/ie/v1/club/members/${s.uid}/handicap/scores`);
 assert.equal(score.init.method,'GET');assert.equal(score.init.headers.Authorization,'Bearer PRIVATE_ACCESS');
 for(const call of s.calls){assert.equal(call.init.redirect,'error');assert.equal(call.init.cache,'no-store');assert.ok(call.init.signal instanceof AbortSignal);}
 const exposed=JSON.stringify(result);for(const privateValue of [s.uid,s.secret,s.username,'PRIVATE_ACCESS','PRIVATE_REFRESH'])assert.equal(exposed.includes(privateValue),false);
 assert.equal(result.lastUpdatedAt,'2031-01-01T00:00:00.000Z');assert.equal(result.player.homeClub,'Selected Club');
});
test('missing credentials, invalid JSON, absent member mapping and malformed member UUID never use network',async()=>{
 const s=setup('missing');
 for(const env of [{},{...s.env,GOLF_IRELAND_CLUB_CREDENTIALS:'invalid'}, {...s.env,GOLF_IRELAND_CLUB_CREDENTIALS:'{}'},{...s.env,GOLF_IRELAND_MEMBER_UIDS:'{}'},{...s.env,GOLF_IRELAND_MEMBER_UIDS:JSON.stringify({'local-club':{'1234567':'https://evil.test/private'}})}]){
  await assert.rejects(s.get({env}),{message:'Golf Ireland information is unavailable. Please try again later.'});
 }
 assert.equal(s.calls.length,0);
});
test('unexpired token is reused; expiry and rotated account secret request a new token',async()=>{
 const s=setup('cache');await s.get();await s.get({now:new Date('2031-01-01T00:59:59Z')});
 assert.equal(s.calls.filter(c=>c.init.method==='POST').length,1);
 const laterFetcher=async(url,init)=>{s.calls.push({url,init});return {ok:true,json:async()=>url.endsWith('/account/token')?{accessToken:'ROTATED_ACCESS',expiresAtUTC:'2031-01-01T03:00:00'}:{handicap:{},scores:[]}};};
 await s.get({now:new Date('2031-01-01T01:00:00Z'),fetcher:laterFetcher});
 assert.equal(s.calls.filter(c=>c.init.method==='POST').length,2);
 const env={...s.env,GOLF_IRELAND_CLUB_CREDENTIALS:JSON.stringify({'local-club':{username:s.username,secretKey:'rotated'}})};
 await s.get({env,fetcher:laterFetcher});assert.equal(s.calls.filter(c=>c.init.method==='POST').length,3);
});
test('expired or invalid token responses are rejected before requesting member data',async()=>{
 for(const expiresAtUTC of ['2030-12-31T23:59:59Z','invalid',null]){
  const s=setup('expired'),calls=[];
  await assert.rejects(s.get({fetcher:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({accessToken:'PRIVATE',expiresAtUTC})};}}),/Golf Ireland information is unavailable/);
  assert.equal(calls.length,1);
 }
});
test('API and transport errors never expose credentials, tokens, request addresses or response bodies',async()=>{
 const s=setup('safe-errors');
 for(const fetcher of [async()=>{throw new Error(`https://private.example.test/${s.secret}/PRIVATE_ACCESS`);},async()=>({ok:false,status:403,json:async()=>({message:`${s.username} PRIVATE_REFRESH`})}),async()=>({ok:true,json:async()=>{throw new Error(s.secret);}})]){
  await assert.rejects(s.get({fetcher}),{message:'Golf Ireland information is unavailable. Please try again later.'});
 }
});
test('display index stays verbatim and recent rounds exclude deleted and invalid scores',async()=>{
 const score=(id,date,extra={})=>({scoreUID:id,playedAtUTC:date,handicapIndex:15,holesPlayed:18,grossScore:88,scoreDifferentialPostPCC:12,marker:{course:'Links',name:'White'},...extra});
 const s=setup('rounds',{handicap:{index:-2.1,displayIndex:'+2.1 (official)',lowIndex:-2.3,counterScoreUIDs:['new']},scores:[score('old','2030-10-01T09:00Z'),score('deleted','2030-12-31T09:00Z',{isDeleted:true}),score('invalid','not-a-date'),score('middle','2030-11-01T09:00Z'),score('new','2030-12-01T09:00Z',{handicapIndex:14.3,holesPlayed:null,grossScore:null}),score('oldest','2030-09-01T09:00Z')]});
 const result=await s.get();assert.equal(result.handicapDisplay,'+2.1 (official)');assert.equal(result.previousHandicapIndex,14.3);assert.equal(result.lowHandicapIndex,-2.3);
 assert.deepEqual(result.recentRounds.map(r=>r.id),['new','middle','old']);assert.equal(result.recentRounds[0].counting,true);assert.equal(result.recentRounds[1].counting,false);
 assert.equal(result.recentRounds[0].holes,null);assert.equal(result.recentRounds[0].grossScore,null);assert.ok(result.recentRounds.every(r=>r.stablefordPoints===null));
 assert.equal(result.recentRounds[0].courseName,'Links');assert.equal(result.recentRounds[0].teeName,'White');
 assert.deepEqual(result.history.map(h=>h.index),[15,15,15,14.3,-2.1]);assert.match(result.notice,/start of recorded rounds/);
});
test('missing values remain null and status flags have defined precedence',async()=>{
 const missing=await setup('nulls',{handicap:{},scores:[{scoreUID:'a',playedAtUTC:'2030-01-01T09:00Z'}]}).get();
 for(const field of ['handicapIndex','handicapDisplay','previousHandicapIndex','lowHandicapIndex'])assert.equal(missing[field],null);
 assert.equal(missing.handicapStatus,'pending');assert.equal(missing.recentRounds[0].counting,null);assert.equal(missing.history.length,0);
 for(const [flag,status] of [['isWithdrawn','withdrawn'],['isPending','pending'],['isFrozen','frozen'],['isProvisional','provisional']]){
  const summary=await setup(flag,{handicap:{index:10,displayIndex:'10.0',[flag]:true},scores:[]}).get();assert.equal(summary.handicapStatus,status);
 }
 const withdrawn=await setup('precedence',{handicap:{index:10,isWithdrawn:true,isPending:true,isFrozen:true,isProvisional:true},scores:[]}).get();assert.equal(withdrawn.handicapStatus,'withdrawn');
});
test('detailed round import validates member ownership and preserves unknowns, pickups and card positions',async()=>{
 const record={handicap:{index:12,displayIndex:'12'},scores:[{scoreUID:'own-score',playedAtUTC:'2030-12-01T09:00Z',holesPlayed:9,grossScore:null,marker:{course:'Selected Course',name:'Back nine'}}]};
 const s=setup('import',record),api={};new Function('require','exports',compiled)(require,api);
 let detail={memberUID:s.uid,scoreUID:'own-score',handicapIndex:12,holes:[{gross:5},{gross:0,pickedUp:true},{gross:null,didNotAttempt:true}]};
 const fetcher=async(url,init)=>url.endsWith('/scores/own-score')?{ok:true,json:async()=>detail}:s.fetcher(url,init);
 const result=await api.getLiveGolfRound(s.request,'own-score',{env:s.env,fetcher,now:new Date('2031-01-01T00:00Z')});
 assert.equal(result.data.holeCount,9);assert.equal(result.data.holes[0].par,null);assert.equal(result.data.holes[0].putts,null);assert.equal(result.data.holes[0].strokes,5);assert.equal(result.data.holes[1].strokes,null);assert.equal(result.data.holes[1].status,'picked_up');assert.equal(result.data.holes[2].status,'not_played');assert.equal(result.importedGross,null);
 record.scores[0].holesPlayed=16;detail={...detail,holes:Array.from({length:18},(_,i)=>i<16?{gross:5}:{gross:null,didNotAttempt:true})};const partial=await api.getLiveGolfRound(s.request,'own-score',{env:s.env,fetcher,now:new Date('2031-01-01T00:00Z')});assert.equal(partial.data.holeCount,18);assert.equal(partial.data.holes.length,18);assert.equal(partial.data.holes[17].status,'not_played');
 detail={...detail,memberUID:'other-person'};await assert.rejects(api.getLiveGolfRound(s.request,'own-score',{env:s.env,fetcher,now:new Date('2031-01-01T00:00Z')}),/could not be imported/);
 await assert.rejects(api.getLiveGolfRound(s.request,'unrelated',{env:s.env,fetcher,now:new Date('2031-01-01T00:00Z')}),/could not be imported/);
});
