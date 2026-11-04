import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import * as catalogue from '../shared/course-catalogue.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
function harness(){const state=[],changes=[];let index=0;const jsx=(type,props)=>({type,props}),api={},deps={react:{useState:initial=>{const i=index++;if(!(i in state))state[i]=initial;return[state[i],next=>{state[i]=next;}];}},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':Object.fromEntries(['Modal','Pressable','ScrollView','TextInput','View'].map(k=>[k,k])),'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'@expo/vector-icons':{Ionicons:'Icon'},'../../../shared/course-catalogue.mjs':catalogue,'../lib/theme':{useTheme:()=>({})},'./ui':{Copy:'Copy'}};
 new Function('require','exports',ts.transpileModule(readFileSync('mobile/src/components/round-course-picker.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(id=>deps[id],api);
 const tee={id:'white',name:'White',colour:'#ffffff',ratingCategory:'men',par:70,courseRating:69.4,slopeRating:123};const castle={id:'castle',clubName:'Castle',name:'Castle',location:'Dublin',tees:[tee]},grange={...castle,id:'grange',clubName:'Grange',name:'Grange'};
 return {changes,castle,tee,render(disabled=false){index=0;return api.RoundCoursePicker({courses:[grange,castle],details:null,homeClubName:'Castle',disabled,onSelect:(...args)=>changes.push(args),onManual:()=>changes.push('manual')});}};
}
function find(node,predicate){if(!node||typeof node!=='object')return;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}}
test('course and tee selection is staged, commits together and dismisses its mounted modal',()=>{
 const h=harness();assert.equal(find(h.render(),n=>n.type==='Modal').props.visible,false);
 find(h.render(),n=>n.props?.accessibilityLabel==='Choose course and tees').props.onPress();let tree=h.render();assert.equal(find(tree,n=>n.type==='Modal').props.visible,true);
 find(tree,n=>n.props?.accessibilityLabel==='Select Castle').props.onPress();assert.deepEqual(h.changes,[]);
 tree=h.render();find(tree,n=>n.props?.accessibilityLabel?.startsWith('White,')).props.onPress();assert.deepEqual(h.changes,[[h.castle,h.tee]]);
 assert.equal(find(h.render(),n=>n.type==='Modal').props.visible,false);
});
test('course search narrows results and a locked selector cannot change the round',()=>{
 const h=harness();let tree=h.render();find(tree,n=>n.props?.accessibilityLabel==='Search courses').props.onChangeText('Grange');tree=h.render();assert.equal(find(tree,n=>n.props?.accessibilityLabel==='Select Castle'),undefined);assert.ok(find(tree,n=>n.props?.accessibilityLabel==='Select Grange'));
 const locked=h.render(true);find(locked,n=>n.props?.accessibilityLabel==='Choose course and tees').props.onPress();find(locked,n=>n.props?.accessibilityLabel==='Enter a course manually').props.onPress();assert.deepEqual(h.changes,[]);assert.equal(find(h.render(true),n=>n.type==='Modal').props.visible,false);
});
