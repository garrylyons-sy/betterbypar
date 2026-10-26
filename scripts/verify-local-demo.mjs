import assert from 'node:assert/strict';
import sharp from 'sharp';
import {localDemoPassword} from '../lib/local-demo.mjs';
const base='http://127.0.0.1:3500';let cookie='';
async function request(path,options={}){
 const response=await fetch(base+path,{...options,headers:{...options.headers,...(cookie?{cookie}:{})},signal:AbortSignal.timeout(45000)});
 const setCookie=response.headers.getSetCookie();if(setCookie.length)cookie=setCookie.map(c=>c.split(';')[0]).join('; ');
 const body=await response.text();let data;try{data=JSON.parse(body);}catch{data=body;}
 return {status:response.status,data};
}
async function login(role){const r=await request('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:`${role}@example.test`,password:localDemoPassword})});assert.equal(r.status,200,JSON.stringify(r.data));}
function json(method,body){return {method,headers:{'content-type':'application/json'},body:JSON.stringify(body)};}
const page=await request('/demo');assert.equal(page.status,200);assert.match(page.data,/Sports Management Platform/);console.log('PASS demo entry page');
await login('admin');let result=await request('/api/admin');assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.adminMode,'platform');
const allClubs=(await request('/api/admin/clubs')).data.clubs;assert.equal(allClubs.length,2);console.log('PASS platform admin and two demo clubs');
await login('clubadmin');result=await request('/api/clubadmin');assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.clubs.length,1);
const own=result.data.clubs[0],other=allClubs.find(c=>c.id!==own.id);
const original={logoPath:own.logo_path??'',primaryColor:own.primary_color??'',accentColor:own.accent_color??''};
result=await request('/api/clubadmin',json('PATCH',{id:own.id,...original,accentColor:'#AABBCC'}));assert.equal(result.status,200,JSON.stringify(result.data));
assert.equal(result.data.club.accent_color,'#AABBCC');
result=await request('/api/clubadmin',json('PATCH',{id:other.id,...original}));assert.equal(result.status,403);
await request('/api/clubadmin',json('PATCH',{id:own.id,...original}));console.log('PASS club branding save and cross-club isolation');
await login('parent');result=await request('/api/dependants');assert.equal(result.status,200,JSON.stringify(result.data));const junior=result.data.dependants[0];assert.ok(junior);assert.equal(junior.first_name,'Casey');
result=await request('/api/lessons');assert.equal(result.status,200,JSON.stringify(result.data));const slot=result.data.slots.find(s=>!s.booked);assert.ok(slot);
result=await request('/api/lessons',json('POST',{slotId:slot.id,playerId:junior.player_id}));assert.equal(result.status,201,JSON.stringify(result.data));
const bookingId=result.data.booking.id;result=await request('/api/lessons',json('PATCH',{id:bookingId}));assert.equal(result.status,200,JSON.stringify(result.data));console.log('PASS dependant access and lesson booking/cancellation');
await login('professional');result=await request('/api/admin/lessons');assert.equal(result.status,200,JSON.stringify(result.data));assert.ok(result.data.slots.length>=9);console.log('PASS professional lesson management');
await login('member');result=await request('/api/session');assert.equal(result.status,200,JSON.stringify(result.data));assert.ok(result.data.contexts.length>0);
const image=await sharp({create:{width:2000,height:1200,channels:3,background:'#28765A'}}).jpeg().toBuffer();
const form=new FormData();form.set('photo',new Blob([image],{type:'image/jpeg'}),'test-photo.jpg');
result=await request('/api/profile/photo',{method:'POST',body:form});assert.equal(result.status,200,JSON.stringify(result.data));
const stored=Buffer.from(result.data.profileImage.split(',')[1],'base64');const metadata=await sharp(stored).metadata();assert.equal(metadata.width,512);assert.ok(metadata.height<=512);assert.ok(stored.length<=150*1024);
result=await request('/api/profile/photo',json('DELETE',{}));assert.equal(result.status,200);console.log('PASS actual upload downscaled to 512 pixels and removal');
await request('/api/logout',{method:'POST'});console.log('Local demo smoke checks passed.');
