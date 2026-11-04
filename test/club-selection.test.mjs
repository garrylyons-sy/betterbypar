import test from 'node:test';import assert from 'node:assert/strict';
import {selectedClubId} from '../shared/club-selection.mjs';
const clubs=[{id:'grange'},{id:'castle'}];
test('non-admins stay on their own club despite a stored or requested alternative',()=>{
 for(const canSwitchClub of [undefined,false])assert.equal(selectedClubId({clubs,defaultClubId:'castle',canSwitchClub},'grange'),'castle');
});
test('only a confirmed admin may select another available club',()=>{
 assert.equal(selectedClubId({clubs,defaultClubId:'castle',canSwitchClub:true},'grange'),'grange');
 assert.equal(selectedClubId({clubs,defaultClubId:'castle',canSwitchClub:true},'unknown'),'castle');
 assert.equal(selectedClubId(null,'grange'),'');
});
