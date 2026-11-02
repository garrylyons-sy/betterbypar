import test from 'node:test';import assert from 'node:assert/strict';
import {customerSection,customerMenuItems,customerRootPage} from '../lib/customer-navigation.mjs';
test('every standalone customer and coaching feature has an app menu section',()=>{
 for(const [route,section] of Object.entries({'/my-golf':'My Golf','/practice':'My Golf','/rounds/review':'My Golf','/lessons':'Lessons','/lessons/manage':'Lessons','/practice/manage':'My Golf','/rounds/coaching':'My Golf','/family':'Menu','/profile':'Menu','/second-hand-clubs':'Menu'}))assert.equal(customerSection(route),section,route);
 for(const route of ['/','/admin','/clubadmin','/demo','/api/rounds','/activate','/reset-password'])assert.equal(customerSection(route),null,route);
 assert.equal(customerSection('/my-golf/'),'My Golf');
});
test('five customer menu destinations include working Club and More deep links',()=>{
 assert.deepEqual(customerMenuItems.map(i=>i.label),['Home','My Golf','Lessons','Club','More']);
 for(const item of customerMenuItems){const url=new URL(item.href,'https://app.test');if(url.searchParams.has('page'))assert.equal(customerRootPage(url.searchParams.get('page')),item.section);}
 assert.equal(customerRootPage('Menu'),'Menu');assert.equal(customerRootPage('Club'),'Club');assert.equal(customerRootPage('My Golf'),'My Golf');assert.equal(customerRootPage('made up'),null);
});
