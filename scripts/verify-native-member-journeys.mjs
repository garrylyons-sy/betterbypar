import assert from 'node:assert/strict';
import {Client} from 'pg';
import {randomUUID} from 'node:crypto';
import {newRoundCard} from '../shared/round-presentation.mjs';
import {drillLogBody,practiceToday} from '../shared/practice-presentation.mjs';
const base=process.env.NATIVE_TEST_ORIGIN??'http://127.0.0.1:3500';
const url=new URL(base);
assert.ok(url.protocol==='http:'&&/^(127\.0\.0\.1|localhost|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname),'Use a private local demo origin.');
const db=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/postgres'});
const tokens=[],roundIds=[],bookingIds=[],assignments=[];
async function api(path,token,body,method=body===undefined?'GET':'POST'){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,data:await response.json()};
}
async function login(identifier){const result=await api('/api/mobile/login',null,{identifier,password:'LocalGolf2026!'});assert.equal(result.status,200,result.data.error);tokens.push(result.data.token);const boot=await api('/api/mobile/session',result.data.token);assert.equal(boot.data.demo,true,'Refuse to write outside the fictional local demo.');return {token:result.data.token,...boot.data};}
await db.connect();
try{
 const member=await login('member@example.test'),club=member.clubs.find(c=>c.name==='Castle Golf Club')??member.clubs[0];
 const lessons=await api('/api/lessons',member.token);assert.equal(lessons.status,200);
 const slot=lessons.data.slots.find(s=>s.club_id===club.id&&!s.group_id&&!s.booked&&!lessons.data.bookings.some(b=>b.status==='Booked'&&b.player_person_id===member.user.personId&&Date.parse(b.starts_at)<Date.parse(s.ends_at)&&Date.parse(b.ends_at)>Date.parse(s.starts_at)));
 assert.ok(slot,'A free fictional lesson slot is required.');
 const booked=await api('/api/lessons',member.token,{slotId:slot.id,playerId:member.user.personId,goals:'Disposable native journey check',reminderMinutes:1440});assert.equal(booked.status,201,booked.data.error);bookingIds.push(booked.data.booking.id);
 assert.equal((await api('/api/lessons',member.token,{id:bookingIds[0],action:'reminder',reminderMinutes:30},'PATCH')).status,200);
 assert.equal((await api('/api/lessons',member.token)).data.bookings.find(b=>b.id===bookingIds[0]).reminder_minutes,30);
 assert.equal((await api('/api/lessons',member.token,{id:bookingIds[0]},'PATCH')).status,200);
 assert.equal((await api('/api/lessons',member.token)).data.bookings.find(b=>b.id===bookingIds[0]).status,'Cancelled');
 const card=newRoundCard('Disposable native journey check',9);card.entryMode='shot_tracking';card.status='completed';card.holes=card.holes.map(h=>({...h,par:4,strokes:5,putts:2,penalties:0,status:'played',comment:h.number===1?'Worked on alignment.':''}));
 const created=await api('/api/rounds',member.token,{action:'create',clubId:club.id,playerId:member.user.personId,data:card});assert.equal(created.status,200,created.data.error);roundIds.push(created.data.round.id);assert.equal(created.data.round.entryMode,'shot_tracking');
 const saved=await api('/api/rounds',member.token,{action:'save',roundId:roundIds[0],revision:created.data.round.revision,data:{...card,commentary:'Added notes in the native journey test.'}});assert.equal(saved.status,200,saved.data.error);assert.equal(saved.data.round.stats.gross,45);assert.equal(saved.data.round.entryMode,'shot_tracking');
 assert.equal((await api('/api/rounds',member.token,{action:'save',roundId:roundIds[0],revision:created.data.round.revision,data:card})).status,409);
 const feedback=await api('/api/rounds',member.token,{action:'feedback',roundId:roundIds[0],consent:true});assert.equal(feedback.status,200,feedback.data.error);assert.equal(feedback.data.round.feedback.mode,'demo');
 const comment={roundId:roundIds[0],revision:saved.data.round.revision,holeNumber:1,body:'Disposable native coaching reply',clientKey:randomUUID()};
 assert.equal((await api('/api/round-coaching',member.token,comment)).status,200);assert.equal((await api('/api/round-coaching',member.token,comment)).status,200);
 assert.equal((await api(`/api/round-coaching?roundId=${roundIds[0]}`,member.token)).data.comments.filter(c=>c.body===comment.body).length,1);
 const imports=await api(`/api/rounds?clubId=${club.id}&playerId=${member.user.personId}&imports=1`,member.token);assert.equal(imports.status,200);assert.equal(imports.data.imports.mode,'demo');
 const body={action:'import',clubId:club.id,playerId:member.user.personId,scoreUID:imports.data.imports.rounds[0].id};const imported=await api('/api/rounds',member.token,body);assert.equal(imported.status,200,imported.data.error);if(!imported.data.alreadyImported)roundIds.push(imported.data.round.id);assert.equal((await api('/api/rounds',member.token,body)).data.round.id,imported.data.round.id);
 const pro=await login('professional@example.test'),manager=await api(`/api/practice?view=coach&clubId=${club.id}`,pro.token);
 const template=manager.data.drills[0];assert.ok(template);
 const assigned=await api('/api/practice',pro.token,{action:'assign',kind:'drill',clubId:club.id,playerId:member.user.personId,coachId:manager.data.actorId,templateId:template.id,clientKey:randomUUID(),startsOn:practiceToday(),goalSessions:3});assert.equal(assigned.status,200,assigned.data.error);assignments.push(assigned.data.id);
 const drill=drillLogBody({id:assigned.data.id,startsOn:practiceToday(),dueOn:null},{date:practiceToday(),minutes:'12',note:'Disposable native practice entry',clientKey:randomUUID()});
 assert.equal((await api('/api/practice',member.token,drill)).status,200);assert.equal((await api('/api/practice',member.token,drill)).status,200);
 const progress=await api(`/api/practice?clubId=${club.id}&playerId=${member.user.personId}`,member.token);assert.equal(progress.data.assignments.find(a=>a.id===assigned.data.id).sessions.length,1);
 const challenge=manager.data.challenges.find(c=>c.definition.rule==='no_lost_balls');assert.ok(challenge);
 const target=await api('/api/practice',pro.token,{action:'assign',kind:'challenge',clubId:club.id,playerId:member.user.personId,coachId:manager.data.actorId,templateId:challenge.id,clientKey:randomUUID(),startsOn:practiceToday(),targetHoles:9});assert.equal(target.status,200,target.data.error);assignments.push(target.data.id);
 const attempt={action:'attest',assignmentId:target.data.id,performedOn:practiceToday(),confirmed:true,met:true,note:'Disposable native attestation',clientKey:randomUUID()};
 assert.equal((await api('/api/practice',member.token,{...attempt,confirmed:false})).status,400);assert.equal((await api('/api/practice',member.token,attempt)).data.result.outcome,'passed');
 console.log('PASS native member journeys: lesson booking/reminder/cancellation; round create/edit/conflict/import/AI; idempotent discussion/drill progress; challenge attestation.');
}finally{
 const ids=[...roundIds,...bookingIds,...assignments];if(ids.length)await db.query('delete from app_notification where event_key like any($1::text[])',[ids.map(id=>`%${id}%`)]);
 if(assignments.length){await db.query('delete from golf_challenge_attempt where assignment_id=any($1::uuid[])',[assignments]);await db.query('delete from golf_drill_session where assignment_id=any($1::uuid[])',[assignments]);await db.query('delete from golf_practice_assignment where id=any($1::uuid[])',[assignments]);}
 if(roundIds.length)await db.query('delete from golf_round where id=any($1::uuid[])',[roundIds]);
 if(bookingIds.length)await db.query('delete from lesson_booking where id=any($1::uuid[])',[bookingIds]);
 for(const token of tokens)await api('/api/mobile/logout',token,{}).catch(()=>{});
 await db.end();
}
