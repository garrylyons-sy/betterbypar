import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBrandTheme,designTokens,designCssVariables} from '../shared/design-system.mjs';
import {buildClubTheme,contrastRatio} from '../lib/club-theme.mjs';
import {golfSummaryView,indexLabel,dateLabel,countingLabel,trendPoints} from '../shared/golf-presentation.mjs';

test('native and web resolve exactly the same accessible club palette and visual scale',()=>{
 for(const primary of ['#FFFFFF','#FFFF00','#061F3E','#777777','#C000A0']){
  const native=buildBrandTheme(primary,'#0878E8'),web=buildClubTheme(primary,'#0878E8');
  for(const [name,css] of Object.entries({primary:'--club-primary',onPrimary:'--club-on-primary',accent:'--club-accent',page:'--club-page',surface:'--club-surface',soft:'--club-soft',border:'--club-border',text:'--club-text',muted:'--club-muted-text'}))assert.equal(native[name],web[css]);
  assert.ok(contrastRatio(native.primary,native.onPrimary)>=4.5);
  assert.ok(contrastRatio(native.primaryText,native.surface)>=4.5);
  assert.ok(contrastRatio(native.primaryText,native.soft)>=4.5);
  assert.equal(native.primaryText,web['--club-primary-text']);
 }
 assert.equal(designCssVariables()['--bbp-index-size'],`${designTokens.type.index}px`);
 assert.equal(designCssVariables()['--bbp-radius-card'],`${designTokens.radius.card}px`);
 assert.equal(buildBrandTheme('invalid','invalid').primary,'#061F3E');
});
test('golf formatting handles plus handicaps, zero, missing values and invalid dates consistently',()=>{
 assert.equal(indexLabel(-1.2),'+1.2');assert.equal(indexLabel(0),'0.0');assert.equal(indexLabel(NaN),'—');
 assert.equal(dateLabel('2026-11-02'),'2 Nov 2026');assert.equal(dateLabel('bad'),'Not available');
 assert.equal(countingLabel(null),'Counting status unavailable');
});
test('summary uses official live display, sorts latest three without changing source and preserves unknown counting',()=>{
 const rounds=[{id:'old',date:'2026-01-01'},{id:'invalid',date:'bad'},{id:'latest',date:'2026-11-02',grossScore:0,counting:null},{id:'second',date:'2026-10-25'},{id:'third',date:'2026-10-20'}];
 const summary={mode:'live',handicapIndex:12.4,handicapDisplay:null,previousHandicapIndex:13.1,history:[],recentRounds:rounds};
 const view=golfSummaryView(summary);
 assert.equal(view.handicap,'—');assert.equal(view.movementLabel,'0.7 better');
 assert.deepEqual(view.rounds.map(r=>r.id),['latest','second','third']);assert.equal(rounds[0].id,'old');
 assert.equal(view.rounds[0].grossScore,0);assert.equal(view.hasUnknownCounting,true);
 assert.equal(golfSummaryView({...summary,mode:'demo',handicapIndex:-1.2}).handicap,'+1.2');
 assert.equal(golfSummaryView({...summary,handicapDisplay:'Pending'}).handicap,'Pending');
 assert.equal(golfSummaryView({...summary,handicapIndex:13.1}).movementLabel,'Unchanged');
});
test('trend drops invalid observations, orders dates and handles a flat index without non-finite coordinates',()=>{
 const points=trendPoints([{date:'bad',index:2},{date:'2026-11-02',index:0},{date:'2026-10-01',index:0},{date:'2026-11-01',index:Infinity}]);
 assert.deepEqual(points.map(p=>p.date),['2026-10-01','2026-11-02']);
 assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
