import assert from 'node:assert/strict';
import {Client} from 'pg';
import {newRoundCard} from '../shared/round-presentation.mjs';
import {applyCatalogueTee} from '../shared/course-catalogue.mjs';
const origin=process.env.NATIVE_TEST_ORIGIN??'http://127.0.0.1:3500';
const url=new URL(origin);
assert.ok(url.protocol==='http:'&&/^(127\.0\.0\.1|localhost|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname),'Use a private local demo origin.');
const db=new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/postgres'});
let token,roundId;
async function api(path,body){const response=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
try{
 assert.equal((await api('/api/courses')).status,401);
 const login=await api('/api/mobile/login',{identifier:'member@example.test',password:'LocalGolf2026!'});assert.equal(login.status,200);token=login.data.token;
 const session=(await api('/api/mobile/session')).data;assert.equal(session.demo,true,'Refuse to write outside the fictional demo.');
 const club=session.clubs.find(c=>c.name==='Castle Golf Club');assert.ok(club);
 const result=await api('/api/courses');assert.equal(result.status,200,result.data.error);
 assert.equal(result.data.courses.length,5);assert.equal(result.data.courses.reduce((n,c)=>n+c.tees.length,0),17);
 const castle=result.data.courses.find(c=>c.slug==='castle-main');const white=castle.tees.find(t=>t.slug==='white-men');
 const card=applyCatalogueTee(newRoundCard('Disposable catalogue test',9),castle,white);card.courseDetails.courseRating=99;
 const created=await api('/api/rounds',{action:'create',clubId:club.id,playerId:session.user.personId,data:card});assert.equal(created.status,200,created.data.error);roundId=created.data.round.id;
 assert.equal(created.data.round.courseDetails.courseRating,69.4);assert.equal(created.data.round.courseDetails.slopeRating,123);assert.equal(created.data.round.courseDetails.holes.length,18);
 assert.equal(created.data.round.holes[0].par,5);assert.equal(created.data.round.holes[0].strokes,null);
 const saved=await api('/api/rounds',{action:'save',roundId,revision:created.data.round.revision,data:{...created.data.round,commentary:'Disposable catalogue snapshot check'}});
 assert.equal(saved.status,200,saved.data.error);assert.equal(saved.data.round.courseDetails.teeId,white.id);
 console.log('PASS live course catalogue: authenticated access, 5 layouts / 17 tees, canonical server ratings, 9-hole card / 18-hole snapshot, save and reload.');
}finally{
 if(roundId){await db.connect();await db.query('delete from golf_round where id=$1',[roundId]);await db.end();}
 if(token)await api('/api/mobile/logout',{});
}
