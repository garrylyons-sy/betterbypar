import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{Client}from'pg';
const db=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/postgres'});await db.connect();
await db.query(await readFile(new URL('../supabase/golf_rounds.sql',import.meta.url),'utf8'));
const base='http://127.0.0.1:3500',ids=[];
async function login(email){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:email,password:'LocalGolf2026!'})});assert.equal(r.status,200);return r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');}
async function api(cookie,path='/api/rounds',body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});assert.equal(r.headers.get('cache-control'),'no-store');return {status:r.status,...await r.json()};}
try{
 const member=await login('member@example.test'),parent=await login('parent@example.test'),pro=await login('professional@example.test');
 const home=await api(member);assert.equal(home.status,200);const selected=home.selected;assert.equal(home.aiMode,'demo');
 const data={courseName:'Smoke test round',teeName:'White',playedOn:new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Dublin'}),holeCount:9,format:'strokes',status:'draft',commentary:'Thought about the target before each shot.',holes:[{number:1,par:4,strokes:5,putts:2,penalties:0,status:'played',comment:'Approach missed left; chose a simple chip.',shots:[]}]};
 const created=await api(member,'/api/rounds',{action:'create',clubId:selected.clubId,playerId:selected.playerId,data});assert.equal(created.status,200,created.error);ids.push(created.round.id);
 assert.equal((await api(parent,'/api/rounds',{action:'save',roundId:created.round.id,revision:1,data})).status,403);
 const finished=await api(member,'/api/rounds',{action:'save',roundId:created.round.id,revision:1,data:{...data,status:'completed'}});assert.equal(finished.status,200,finished.error);
 const f=await api(member,'/api/rounds',{action:'feedback',roundId:created.round.id,consent:true});assert.equal(f.status,200,f.error);assert.equal(f.round.feedback.mode,'demo');assert.equal(f.round.feedback.thoughts.length,3);
 const imports=await api(member,'/api/rounds?imports=1');assert.equal(imports.imports.mode,'demo');
 const request={action:'import',clubId:selected.clubId,playerId:selected.playerId,scoreUID:imports.imports.rounds[0].id};
 const imported=await api(member,'/api/rounds',request);assert.equal(imported.status,200,imported.error);if(!imported.alreadyImported)ids.push(imported.round.id);
 const again=await api(member,'/api/rounds',request);assert.equal(again.round.id,imported.round.id);
 if(!imported.alreadyImported){const notes=await api(member,'/api/rounds',{action:'save',roundId:imported.round.id,revision:imported.round.revision,data:{...imported.round,commentary:'Import review',holes:imported.round.holes.map((h,i)=>({...h,comment:i===0?'Reviewed the first-hole choice.':h.comment}))}});assert.equal(notes.status,200,notes.error);assert.equal(notes.round.holes[0].comment,'Reviewed the first-hole choice.');}
 assert.equal((await api(pro)).options.length,0);
 console.log('PASS local HTTP draft/finish/feedback, self isolation, import, duplicate protection, hole commentary and coach exclusion');
}finally{if(ids.length)await db.query("delete from golf_round where id=any($1::uuid[])",[ids]);await db.end();}
