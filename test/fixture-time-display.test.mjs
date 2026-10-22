import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {formatFixtureDateTime} from '../lib/fixture-scheduling.mjs';
test('date-only Castle fixture displays the standard Irish match time instead of midnight UTC',()=>{
 for(const value of ['2026-10-22 00:00:00+00','2026-10-22T00:00:00Z','2026-10-22'])assert.equal(formatFixtureDateTime(value),'22 Oct, 19:30');
});
test('explicit fixture times are preserved and displayed in Irish time across daylight saving',()=>{
 assert.equal(formatFixtureDateTime('2026-10-22 18:30:00+00'),'22 Oct, 19:30');
 assert.equal(formatFixtureDateTime('2026-10-22T19:30:00Z'),'22 Oct, 20:30');
 assert.equal(formatFixtureDateTime('2026-12-03 19:30:00+00'),'3 Dec, 19:30');
 assert.equal(formatFixtureDateTime('2026-10-22T23:30:00Z'),'23 Oct, 00:30');
});
test('invalid fixture dates get an honest placeholder',()=>{
 assert.equal(formatFixtureDateTime('not a date'),'Date to be confirmed');
});

test('viewing on a device abroad still shows the Irish fixture time',()=>{
 const script=`import {formatFixtureDateTime} from ${JSON.stringify(new URL('../lib/fixture-scheduling.mjs',import.meta.url).href)};console.log(formatFixtureDateTime('2026-10-22T18:30:00Z'));`;
 assert.equal(execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ:'America/Los_Angeles'},encoding:'utf8'}).trim(),'22 Oct, 19:30');
});
