import test from 'node:test';import assert from 'node:assert/strict';
import {formatRoundDate,parseRoundDate,roundDatePattern} from '../mobile/src/lib/round-date.mjs';
test('round dates display and parse according to the device region with canonical storage',()=>{
 for(const [locale,date,pattern] of [['en-IE','04/11/2026','dd/mm/yyyy'],['en-US','11/04/2026','mm/dd/yyyy'],['de-DE','04.11.2026','dd.mm.yyyy'],['ja-JP','2026/11/04','yyyy/mm/dd']]){
  assert.equal(formatRoundDate('2026-11-04',locale),date);assert.equal(roundDatePattern(locale),pattern);assert.equal(parseRoundDate(date,locale),'2026-11-04');
 }
 assert.equal(parseRoundDate('04-11-2026','en-IE'),'2026-11-04');
});
test('round dates reject impossible, partial and ambiguous years without timezone shifts',()=>{
 for(const value of ['31/02/2026','29/02/2025','01/13/2026','4/11/26','04/11/',''])assert.equal(parseRoundDate(value,'en-IE'),null);
 assert.equal(parseRoundDate('29/02/2024','en-IE'),'2024-02-29');assert.equal(formatRoundDate('2026-02-31','en-IE'),'');
});
