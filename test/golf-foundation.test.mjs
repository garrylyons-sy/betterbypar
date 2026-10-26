import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppointments, canManageLessons, canActForPlayer, normalizeLessonSlot } from '../lib/golf-policy.ts';
const club = 'a';
test('clubs require an administrator and full professional, assistants are optional', () => {
  assert.throws(() => normalizeAppointments({ administratorIds: [], professionalIds: ['p'] }), /administrator/i);
  assert.throws(() => normalizeAppointments({ administratorIds: ['a'], professionalIds: [], assistantProfessionalIds: ['p'] }), /Golf Professional/);
  assert.deepEqual(normalizeAppointments({ administratorIds: ['a', 'a'], professionalIds: ['p', 'q'] }), { administratorIds: ['a'], professionalIds: ['p', 'q'], assistantProfessionalIds: [] });
  assert.throws(() => normalizeAppointments({administratorIds:['a'], professionalIds:['p'], assistantProfessionalIds:['p']}), /both/);
});
test('professional lesson authority is club scoped and requires an active assignment', () => {
  assert.equal(canManageLessons(false, [], [{clubId:club, role:'Golf Professional', active:true}], club), true);
  assert.equal(canManageLessons(false, [], [{clubId:'b', role:'Golf Professional', active:true}], club), false);
  assert.equal(canManageLessons(false, [], [{clubId:club, role:'Assistant Professional', active:false}], club), false);
  assert.equal(canManageLessons(false, [], [{clubId:club, role:'Club Member', active:true}], club), false);
  assert.equal(canManageLessons(false, [club], [], club), true);
});
test('delegation requires an active direct guardian relationship in the requested club', () => {
  const relationship = {guardianId:'parent', playerId:'child', clubId:club, active:true};
  assert.equal(canActForPlayer('parent','child',club,[relationship]), true);
  assert.equal(canActForPlayer('parent','other',club,[relationship]), false);
  assert.equal(canActForPlayer('parent','child','b',[relationship]), false);
  assert.equal(canActForPlayer('parent','child',club,[{...relationship,active:false}]), false);
  assert.equal(canActForPlayer('parent','parent',club,[]), true);
});
test('lesson slots require explicit timezone, valid dates and positive bounded duration', () => {
  const input = {clubId:'a',professionalId:'p',title:'Short game',startsAt:'2030-01-01T10:00:00+00:00',endsAt:'2030-01-01T10:30:00Z'};
  assert.equal(normalizeLessonSlot(input).title,'Short game');
  assert.throws(() => normalizeLessonSlot({...input,endsAt:input.startsAt}), /after/);
  assert.throws(() => normalizeLessonSlot({...input,startsAt:'2030-01-01T10:00'}), /timezone/);
  assert.throws(() => normalizeLessonSlot({...input,professionalId:''}), /professional/i);
  assert.throws(() => normalizeLessonSlot({...input,endsAt:'2030-01-02T10:00:00Z'}), /four hours/);
});

test('active membership evidence must include both guardian and dependant', async () => {
 const {hasActivePlayers}=await import('../lib/golf-policy.ts');
 assert.equal(hasActivePlayers(['parent'],'parent','inactive-child'),false);
 assert.equal(hasActivePlayers(['parent','child'],'parent','child'),true);
 assert.equal(hasActivePlayers(['parent'],'parent','parent'),true);
 assert.equal(hasActivePlayers([],'parent','parent'),false);
});
