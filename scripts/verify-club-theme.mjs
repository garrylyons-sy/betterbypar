import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:3500';
async function login(email){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:email,password:'LocalGolf2026!'})});assert.equal(r.status,200);return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}
async function api(cookie,path,method='GET',body){const r=await fetch(base+path,{method,headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});return {status:r.status,...await r.json()};}
const backup=new URL('../.local-demo/theme-verification.json',import.meta.url);
const admin=await login('clubadmin@example.test');
if(process.argv[2]==='restore'){
 const saved=JSON.parse(await readFile(backup,'utf8'));
 assert.equal((await api(admin,'/api/clubadmin','PATCH',saved)).status,200);
 console.log('Restored original club colours.');
}else{
 const anonymous=await api('','/api/club-theme');assert.equal(anonymous.status,401);assert.deepEqual(anonymous.clubs,[]);
 const member=await login('member@example.test'),pro=await login('professional@example.test');
 const memberTheme=await api(member,'/api/club-theme'),proTheme=await api(pro,'/api/club-theme');
 assert.equal(memberTheme.status,200);assert.equal(memberTheme.clubs.length,1);assert.equal(memberTheme.clubs[0].name,'Castle Golf Club');assert.equal(proTheme.clubs.length,2);
 const clubs=await api(admin,'/api/clubadmin'),club=clubs.clubs.find(c=>c.name==='Castle Golf Club');
 const saved={id:club.id,logoPath:club.logo_path,primaryColor:club.primary_color,accentColor:club.accent_color};
 await writeFile(backup,JSON.stringify(saved));
 const colours={...saved,primaryColor:'#FFD700',accentColor:'#4B0082'};
 assert.equal((await api(member,'/api/clubadmin','PATCH',colours)).status,403);
 try{
  assert.equal((await api(admin,'/api/clubadmin','PATCH',colours)).status,200);
  const next=(await api(member,'/api/club-theme')).clubs[0];assert.equal(next.primaryColor,'#FFD700');assert.equal(next.accentColor,'#4B0082');
  assert.equal((await api(pro,'/api/club-theme')).clubs.find(c=>c.name==='Woodland Golf Club').primaryColor,proTheme.clubs.find(c=>c.name==='Woodland Golf Club').primaryColor);
  console.log('PASS authentication, club scoping, administrator save, member theme refresh and other-club isolation.');
 }finally{if(process.argv[2]!=='apply')await api(admin,'/api/clubadmin','PATCH',saved);}
}
