import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRanges,weekStart,dublinDate,reminderMinutes,lessonText} from '../lib/lesson-diary.mjs';
test('availability uses half-hour grid, allows split shifts and rejects overlaps',()=>{
 assert.equal(normalizeRanges([{day:0,start:'09:00',end:'12:00'},{day:0,start:'13:00',end:'17:30'}]).length,2);
 for(const range of [{day:0,start:'09:15',end:'10:00'},{day:7,start:'09:00',end:'10:00'},{day:0,start:'12:00',end:'10:00'}])assert.throws(()=>normalizeRanges([range]));
 assert.throws(()=>normalizeRanges([{day:0,start:'09:00',end:'12:00'},{day:0,start:'11:30',end:'13:00'}]));
 assert.deepEqual(normalizeRanges([]),[]);
});
test('week navigation stays on Dublin calendar across DST',()=>{
 assert.equal(weekStart('2026-10-25'),'2026-10-19');assert.equal(weekStart('2026-10-26'),'2026-10-26');
 assert.equal(dublinDate('2026-06-01T23:30:00Z'),'2026-06-02');assert.throws(()=>weekStart('2026-02-30'));
});
test('reminders default to24h and notes have bounded plain text',()=>{
 assert.equal(reminderMinutes(),1440);assert.equal(reminderMinutes(0),0);assert.throws(()=>reminderMinutes(13));
 assert.equal(lessonText('  Putting  ',2000,'Goals'),'Putting');assert.throws(()=>lessonText('x'.repeat(2001),2000,'Goals'));
});
