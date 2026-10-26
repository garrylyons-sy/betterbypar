import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{Client}from'pg';
const db=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/postgres'});await db.connect();await db.query(await readFile(new URL('../supabase/round_coaching.sql',import.meta.url),'utf8'));
const base='http://127.0.0.1:3500',roundIds=[],assignmentIds=[],commentIds=[];
async function login(email){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:email,password:'LocalGolf2026!'})});assert.equal(r.status,200);return r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');}
async function api(cookie,path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
try{
 const pro=await login('professional@example.test'),parent=await login('parent@example.test'),member=await login('member@example.test');
 const manager=await api(pro,'/api/practice?view=coach');assert.equal(manager.status,200,manager.error);const club=manager.clubId,child=manager.options.find(p=>p.name==='Casey Parker').playerId;
 const assigned=await api(pro,'/api/practice',{action:'assign',kind:'challenge',clubId:club,playerId:child,coachId:manager.actorId,templateId:manager.challenges[0].id,startsOn:'2026-01-01',clientKey:crypto.randomUUID()});assert.equal(assigned.status,200,assigned.error);assignmentIds.push(assigned.id);
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Dublin'}),data={courseName:'Disposable coaching test',teeName:'White',playedOn:today,holeCount:18,status:'completed',format:'strokes',commentary:'Tee shots felt rushed.',handicapIndex:15,playingHandicap:16,holes:Array.from({length:18},(_,i)=>({number:i+1,status:'played',par:4,strokes:5,putts:2,penalties:0,comment:i===0?'Pushed tee shot.':'',shots:[]}))};
 const created=await api(parent,'/api/rounds',{action:'create',clubId:club,playerId:child,data});assert.equal(created.status,200,created.error);roundIds.push(created.round.id);const rid=created.round.id;
 const path=`/api/round-coaching?view=coach&roundId=${rid}`;const viewed=await api(pro,path);assert.equal(viewed.status,200,viewed.error);assert.equal(viewed.round.data.commentary,data.commentary);
 assert.equal((await api(member,`/api/round-coaching?roundId=${rid}`)).status,403);
 const comment={roundId:rid,revision:1,body:'Slow the transition and commit to your target.',holeNumber:1,clientKey:crypto.randomUUID()};const sent=await api(pro,'/api/round-coaching',comment);assert.equal(sent.status,200,sent.error);commentIds.push(sent.id);assert.equal((await api(pro,'/api/round-coaching',comment)).id,sent.id);
 const reply=await api(parent,'/api/round-coaching',{...comment,body:'We will practise that before the next lesson.',clientKey:crypto.randomUUID()});assert.equal(reply.status,200,reply.error);commentIds.push(reply.id);assert.equal((await api(parent,`/api/round-coaching?roundId=${rid}`)).comments.length,2);
 const linked=await api(pro,'/api/practice',{action:'assign',kind:'drill',clubId:club,playerId:child,coachId:manager.actorId,templateId:manager.drills[0].id,sourceRoundId:rid,startsOn:today,clientKey:crypto.randomUUID()});assert.equal(linked.status,200,linked.error);assignmentIds.push(linked.id);
 assert.equal((await api(parent,`/api/practice?clubId=${club}&playerId=${child}`)).assignments.find(a=>a.id===linked.id).sourceRoundId,rid);
 assert.equal((await api(pro,'/api/rounds',{action:'save',roundId:rid,revision:1,data})).status,403);
 const draft=await api(parent,'/api/rounds',{action:'create',clubId:club,playerId:child,data:{...data,status:'draft'}});assert.equal(draft.status,200,draft.error);roundIds.push(draft.round.id);assert.equal((await api(pro,`/api/round-coaching?view=coach&roundId=${draft.round.id}`)).status,403);
 assert.ok((await db.query("select id from app_notification where type='round_comment' and event_key=any($1::text[])",[commentIds.map(id=>`round-comment:${id}`)])).rows.length>=2);
 console.log('PASS local HTTP: related pro reads completed round, unrelated denied, hole feedback, guardian reply, duplicate-safe comments, linked practice, pro score edits denied, drafts private and standard notifications created.');
}finally{
 if(commentIds.length)await db.query("delete from app_notification where type='round_comment' and event_key=any($1::text[])",[commentIds.map(id=>`round-comment:${id}`)]);
 if(assignmentIds.length){await db.query("delete from app_notification where type='coaching_assignment' and event_key=any($1::text[])",[assignmentIds.map(id=>`practice-assigned:${id}`)]);await db.query('delete from golf_practice_assignment where id=any($1::uuid[])',[assignmentIds]);}
 if(roundIds.length)await db.query('delete from golf_round where id=any($1::uuid[])',[roundIds]);await db.end();
}
