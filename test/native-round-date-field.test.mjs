import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import * as dates from '../mobile/src/lib/round-date.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
test('partial native date entry invalidates the form without replacing its canonical saved value',()=>{
 let state;const changes=[],validity=[],api={},jsx=(type,props)=>({type,props}),deps={react:{useState:initial=>[state??initial,next=>{state=next;}],useEffect:fn=>fn()},'react-native':{View:'View'},'react/jsx-runtime':{jsx,jsxs:jsx},'../lib/round-date.mjs':dates,'./round-fields':{RoundTextInput:'Input'},'./ui':{Copy:'Copy'}};
 new Function('require','exports',ts.transpileModule(readFileSync('mobile/src/components/round-date-field.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(id=>deps[id],api);
 const render=(disabled=false)=>api.RoundDateField({value:'2026-11-04',disabled,onChange:iso=>changes.push(iso),onValidityChange:valid=>validity.push(valid)});
 const input=tree=>tree.props.children[0];input(render()).props.onChangeText('99/');assert.equal(validity.at(-1),false);assert.deepEqual(changes,[]);
 input(render()).props.onChangeText(dates.formatRoundDate('2026-11-05'));assert.deepEqual(changes,['2026-11-05']);assert.equal(validity.at(-1),true);
 input(render(true)).props.onChangeText(dates.formatRoundDate('2026-11-06'));assert.deepEqual(changes,['2026-11-05']);
});
