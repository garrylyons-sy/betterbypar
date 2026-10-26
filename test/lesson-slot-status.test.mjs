import test from 'node:test';
import assert from 'node:assert/strict';
import {lessonSlotStatus} from '../lib/lesson-slot-status.mjs';
const now=Date.parse('2031-06-02T08:00Z');
const slot={active:true,starts_at:'2031-06-02T09:00Z',ends_at:'2031-06-02T09:30Z'};
test('individual diary slots distinguish available, busy, cancelled and past',()=>{
 assert.equal(lessonSlotStatus(slot,now).state,'available');
 assert.equal(lessonSlotStatus({...slot,booking_id:'booking'},now).state,'busy');
 assert.equal(lessonSlotStatus({...slot,active:false,booking_id:'booking'},now).label,'Cancelled');
 assert.equal(lessonSlotStatus(slot,Date.parse('2031-06-02T09:45Z')).label,'Unbooked');
 assert.equal(lessonSlotStatus({...slot,booking_id:'booking'},Date.parse('2031-06-02T09:45Z')).label,'Completed');
 assert.equal(lessonSlotStatus(slot,Date.parse('2031-06-02T09:15Z')).label,'In progress');
});
test('group diary distinguishes empty, partial, full, unlimited and fixed roster sessions',()=>{
 const group={...slot,group_id:'group',group_mode:'Open',capacity:8};
 assert.equal(lessonSlotStatus({...group,booked_count:0},now).state,'available');
 assert.equal(lessonSlotStatus({...group,booked_count:1},now).state,'partial');
 assert.equal(lessonSlotStatus({...group,booked_count:8},now).state,'busy');
 assert.equal(lessonSlotStatus({...group,booked_count:9},now).state,'busy');
 assert.equal(lessonSlotStatus({...group,capacity:null,booked_count:20},now).state,'partial');
 assert.equal(lessonSlotStatus({...group,group_mode:'Roster',booked_count:1},now).state,'busy');
});
