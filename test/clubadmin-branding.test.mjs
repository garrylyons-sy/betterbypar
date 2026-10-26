import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeClubBrandingInput} from '../lib/server/admin-clubs.ts';

test('club branding normalizes its own logo and colours',()=>{
 assert.deepEqual(normalizeClubBrandingInput({id:'club',logoPath:'/logo.png',primaryColor:'#0a1b2c',accentColor:'#abcdef'}),{logoPath:'/logo.png',primaryColor:'#0A1B2C',accentColor:'#ABCDEF'});
 assert.equal(normalizeClubBrandingInput({logoPath:'',primaryColor:'',accentColor:''}).logoPath,null);
});
test('club branding refuses administrative fields rather than granting privileges',()=>{
 for(const patch of [{name:'Other club'},{active:false},{professionalIds:['someone']},{administratorIds:['someone']},{clubId:'other'},{is_club_admin:true}]){
  assert.throws(()=>normalizeClubBrandingInput(patch),/only.*logo.*colours/i);
 }
});
test('club branding enforces existing colour and image limits',()=>{
 assert.throws(()=>normalizeClubBrandingInput({primaryColor:'red'}),/hexadecimal/);
 assert.throws(()=>normalizeClubBrandingInput({logoPath:'data:image/svg+xml;base64,PHN2Zz4='}),/PNG/);
});

test('club portal links resolve only to club-supported sections',async()=>{
 const {resolveClubPortalTab}=await import('../lib/club-portal.ts');
 assert.equal(resolveClubPortalTab(null),'clubs');
 for(const tab of ['clubs','lessons','dependants','challenges']) assert.equal(resolveClubPortalTab(tab),tab);
 for(const tab of ['permissions','system','matches','people','ladders','unknown']) assert.equal(resolveClubPortalTab(tab),'clubs');
});
