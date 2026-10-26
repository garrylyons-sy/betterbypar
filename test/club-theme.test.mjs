import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClubTheme,contrastRatio,foregroundFor} from '../lib/club-theme.mjs';
test('club palette derives surfaces and legible foregrounds from both configured colours',()=>{
 for(const primary of ['#FFFFFF','#000000','#FFFF00','#0044AA','#B100AB','#777777','#00FF00']){
  const theme=buildClubTheme(primary,'#F5F500');
  assert.equal(theme['--club-primary'],primary);
  assert.ok(contrastRatio(primary,theme['--club-on-primary'])>=4.5);
  assert.ok(contrastRatio(theme['--club-accent'],theme['--club-on-accent'])>=4.5);
  assert.ok(contrastRatio(theme['--club-text'],theme['--club-page'])>=4.5);
  assert.ok(contrastRatio(theme['--club-muted-text'],theme['--club-surface'])>=4.5);
 }
 assert.notEqual(buildClubTheme('#0055AA','#AA0055')['--club-page'],buildClubTheme('#005500','#AA0055')['--club-page']);
 assert.equal(foregroundFor('#FFFFFF'),'#000000');
});
test('invalid colours cannot escape CSS and use safe platform defaults',()=>{
 const theme=buildClubTheme('red;display:none','url(https://invalid.example)');
 assert.equal(theme['--club-primary'],'#061F3E');assert.equal(theme['--club-accent'],'#0878E8');
 assert.ok(Object.values(theme).every(v=>!/[;{}]/.test(v)));
});
