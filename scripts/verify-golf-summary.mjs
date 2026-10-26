import assert from 'node:assert/strict';
const base='http://127.0.0.1:3500';
async function login(email){
 const response=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:email,password:'LocalGolf2026!'})});
 assert.equal(response.status,200);
 return response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
}
async function summary(cookie,playerId){
 const query=new URLSearchParams({club:'Castle Golf Club'});if(playerId)query.set('playerId',playerId);
 const response=await fetch(`${base}/api/golf-summary?${query}`,{headers:cookie?{cookie}:{}});
 assert.equal(response.headers.get('cache-control'),'no-store');
 return {status:response.status,body:await response.json()};
}
assert.equal((await summary()).status,401);
const memberCookie=await login('member@example.test');
const member=await summary(memberCookie);
assert.equal(member.status,200);assert.equal(member.body.summary.mode,'demo');
assert.equal(typeof member.body.summary.handicapIndex,'number');assert.equal(member.body.summary.recentRounds.length,3);
assert.match(member.body.summary.notice,/illustrative/i);
const parent=await summary(await login('parent@example.test'));
assert.equal(parent.status,200);assert.ok(parent.body.players.length);
assert.ok(parent.body.players.some(player=>!player.isSelf));
const juniorId=parent.body.players.find(player=>!player.isSelf).id;
assert.equal((await summary(memberCookie,juniorId)).status,403);
const junior=await summary(await login('parent@example.test'),juniorId);
assert.equal(junior.status,200);assert.equal(junior.body.summary.player.id,juniorId);
for(const email of ['professional@example.test','assistant@example.test']){
 const staff=await summary(await login(email));assert.equal(staff.status,200);assert.deepEqual(staff.body.players,[]);assert.equal(staff.body.summary,null);
}
assert.doesNotMatch(JSON.stringify(member.body),/secretKey|accessToken|clientToken/);
console.log('PASS live local HTTP: sample handicap and 3 rounds, guardian selection, unrelated player denied, coaches excluded, no-store and unauthenticated denial');
