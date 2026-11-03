import test from 'node:test';import assert from 'node:assert/strict';import {lessonSlotsForProfessional} from '../shared/lesson-presentation.mjs';
const slots=[{id:'one',professional_person_id:'colin'},{id:'two',professional_person_id:'shane'},{id:'group',professional_person_id:'colin',group_id:'cubs'}];
test('a professional must be explicitly chosen before times appear',()=>{assert.deepEqual(lessonSlotsForProfessional(slots,''),[]);assert.deepEqual(lessonSlotsForProfessional(slots,'unknown'),[]);});
test('selected professional includes their individual and group sessions only',()=>assert.deepEqual(lessonSlotsForProfessional(slots,'colin').map(s=>s.id),['one','group']));
