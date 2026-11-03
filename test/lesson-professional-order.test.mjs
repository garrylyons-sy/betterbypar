import test from 'node:test';
import assert from 'node:assert/strict';
import {compareLessonProfessionals} from '../shared/lesson-presentation.mjs';
test('professionals precede assistants regardless of name or earliest available time',()=>{const entries=[{name:'Aaron Assistant',role:'Assistant Professional'},{name:'Zoe Pro',role:'Golf Professional'},{name:'Colin Pro',role:'Golf Professional'},{name:'Shane Assistant',role:'Assistant Professional'}];assert.deepEqual(entries.sort(compareLessonProfessionals).map(p=>p.name),['Colin Pro','Zoe Pro','Aaron Assistant','Shane Assistant']);assert.equal(compareLessonProfessionals({professional_role:'Golf Professional',professional_name:'Zoe'},{professional_role:'Assistant Professional',professional_name:'Aaron'}),-1);});
