import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {buildBrandTheme,designTokens} from '../shared/design-system.mjs';
const require=createRequire(import.meta.url),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load({resource={data:null,loading:false,error:'',reload(){}},theme=buildBrandTheme(),hooks=null,request=async()=>({ok:true})}={}){
 const exports={},destinations=[],paths=[],selectedClubs=[];
 const Container=({children})=>React.createElement('div',null,children),Text=({children})=>React.createElement('span',null,children),Pressable=({children,onPress,accessibilityLabel})=>React.createElement('button',{'aria-label':accessibilityLabel,onClick:onPress},children);
 const ui={Copy:Text,Card:Container,Page:Container,Action:({label})=>React.createElement('button',null,label),Status:({loading,error})=>React.createElement('div',null,loading?'Loading':error),useResource:path=>{paths.push(path);return resource;}};
 const deps={'react':{...React,useCallback:fn=>fn,...(hooks?{useState:hooks.useState}:{})},'react-native':{Image:()=>null,View:Container,Text,Pressable,StyleSheet:{create:s=>s}},'@expo/vector-icons':{Ionicons:()=>null},'expo-router':{router:{navigate:to=>destinations.push(to)},useFocusEffect(){}},'../lib/session':{useSession:()=>({club:{id:'castle'},request,setClub:id=>selectedClubs.push(id)})},'../lib/theme':{useTheme:()=>theme,designTokens},'../lib/draft-guard':{useDraftGuard:()=>({run:f=>f()}),useDraftRegistration(){}},'./native-profile':{NativeProfilePhotoEditor:()=>null},'./ui':ui,'./golf-controls':{EmptyState:({title,detail})=>React.createElement('div',null,title,detail),Input:({label,value})=>React.createElement('label',null,label,React.createElement('input',{defaultValue:value}))}};
 new Function('require','exports',ts.transpileModule(readFileSync('mobile/src/components/native-dependants.tsx','utf8')+'\nexport {DependantEditor,DependantGolfCard};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(id=>deps[id]??require(id),exports);
 return {...exports,destinations,paths,selectedClubs};
}
const row={id:'link',club_id:'castle',club_name:'Castle Golf Club',player_id:'junior',relationship:'Guardian',first_name:'Casey',last_name:'Parker',phone:null,golf_ireland_number:'12345'};
test('Home dependant panels filter by active club and open the precise My Golf context',()=>{
 const {DependantCards,destinations}=load();const element=DependantCards({rows:[row,{...row,id:'other',club_id:'grange',first_name:'Hidden'}],clubId:'castle'}),html=renderToStaticMarkup(element);
 assert.match(html,/Casey Parker/);assert.match(html,/View My Golf/);assert.doesNotMatch(html,/Hidden|Manage contact/);
 element.props.children[1][0].type(element.props.children[1][0].props).props.onPress();assert.equal(destinations[0].pathname,'/my-golf');assert.deepEqual({...destinations[0].params,intent:undefined},{playerId:'junior',clubId:'castle',section:'rounds',intent:undefined});assert.ok(destinations[0].params.intent);
 assert.equal(DependantCards({rows:[row],clubId:'grange'}),null);
});
test('dependant panels keep long names and club labels with a pale club palette',()=>{
 const {DependantCards}=load({theme:buildBrandTheme({primaryColor:'#f5f0ec',accentColor:'#fff9cc'})});
 const html=renderToStaticMarkup(DependantCards({rows:[{...row,first_name:'Alexandria Catherine',last_name:'O’Donnell Fitzgerald'}],clubId:'castle'}));assert.match(html,/Alexandria Catherine/);assert.match(html,/O’Donnell Fitzgerald/);assert.match(html,/Castle Golf Club/);
});
test('native family provides contact fields, registered identity and photo management',()=>{
 const {NativeDependants,paths}=load({resource:{data:{dependants:[row]},loading:false,error:'',reload(){}}});const html=renderToStaticMarkup(React.createElement(NativeDependants));
 for(const label of ['Casey','Castle Golf Club','guardian','12345','First name','Last name','Phone','Save contact details','Book a lesson'])assert.ok(html.includes(label),label);assert.deepEqual(paths,['/api/dependants']);
});
test('native family handles loading, access errors and unlinked accounts',()=>{
 for(const [resource,label] of [[{data:null,loading:true,error:''},'Loading'],[{data:null,loading:false,error:'Access revoked'},'Access revoked'],[{data:{dependants:[]},loading:false,error:''},'No dependants linked']]){const {NativeDependants}=load({resource:{...resource,reload(){}}});assert.ok(renderToStaticMarkup(React.createElement(NativeDependants)).includes(label));}
});
test('Home keeps the signed in summary and upcoming lesson panel separate from dependants',()=>{
 const home=readFileSync('mobile/src/app/(tabs)/index.tsx','utf8');assert.match(home,/selectedPlayerId===session\?\.user.personId/);assert.match(home,/<NativeUpcomingLessonPanel/);assert.match(home,/<NativeDependantPanel/);assert.doesNotMatch(home,/setSelection|Choose whose golf to view/);
});

function stateHarness(){let cursor=0;const values=[];return {reset(){cursor=0;},useState(initial){const index=cursor++;if(!(index in values))values[index]=typeof initial==='function'?initial():initial;return [values[index],value=>{values[index]=typeof value==='function'?value(values[index]):value;}];}};}
function childWith(element,predicate){if(!element||typeof element!=='object')return null;if(predicate(element))return element;for(const child of [element.props?.children].flat(Infinity)){const match=childWith(child,predicate);if(match)return match;}return null;}
test('saving dependant contacts uses the authorised target and PATCH with trimmed values',async()=>{
 const hooks=stateHarness(),calls=[],dirty=[],{DependantEditor}=load({hooks,request:async(...args)=>{calls.push(args);return {ok:true};}});
 const render=()=>{hooks.reset();return DependantEditor({row,onDirty:(...args)=>dirty.push(args)});};
 let element=render();childWith(element,e=>e.props?.label==='First name').props.onChangeText('  Cassidy  ');
 element=render();const save=childWith(element,e=>e.props?.label==='Save contact details');assert.equal(save.props.disabled,false);save.props.onPress();await new Promise(setImmediate);
 assert.deepEqual(calls,[['/api/dependants',{clubId:'castle',playerId:'junior',firstName:'Cassidy',lastName:'Parker',phone:''},'PATCH']]);
 element=render();assert.equal(childWith(element,e=>e.props?.label==='Save contact details').props.disabled,true);assert.ok(childWith(element,e=>e.props?.children==='Contact details saved.'));assert.deepEqual(dirty.at(-1),['link',false]);
});
test('failed contact save preserves the edit and exposes the server error',async()=>{
 const hooks=stateHarness(),{DependantEditor}=load({hooks,request:async()=>{throw new Error('This dependant is no longer linked.');}});
 const render=()=>{hooks.reset();return DependantEditor({row,onDirty(){}});};let element=render();childWith(element,e=>e.props?.label==='Phone').props.onChangeText('0871234567');element=render();childWith(element,e=>e.props?.label==='Save contact details').props.onPress();await new Promise(setImmediate);element=render();assert.equal(childWith(element,e=>e.props?.label==='Phone').props.value,'0871234567');assert.equal(childWith(element,e=>e.props?.label==='Save contact details').props.disabled,false);assert.ok(childWith(element,e=>e.props?.error==='This dependant is no longer linked.'));
});

test('family booking preserves a dependant at another club',()=>{const hooks=stateHarness(),{DependantEditor,destinations,selectedClubs}=load({hooks});hooks.reset();const element=DependantEditor({row:{...row,club_id:'grange'},onDirty(){}});childWith(element,e=>e.props?.label==='Book a lesson').props.onPress();assert.deepEqual(selectedClubs,['grange']);assert.equal(destinations[0].pathname,'/lessons');assert.equal(destinations[0].params.playerId,'junior');assert.equal(destinations[0].params.clubId,'grange');});

const summary={player:{id:'junior'},handicapDisplay:'+1.2',handicapStatus:'provisional',recentRounds:[{date:'2031-06-03',grossScore:72}],mode:'live'};
test('native dependant cards load player-scoped golf summaries and show handicap, round and source',()=>{
 const {DependantGolfCard,paths}=load({resource:{data:{selectedPlayerId:'junior',summary},loading:false,error:'',reload(){}}});
 const html=renderToStaticMarkup(React.createElement(DependantGolfCard,{row}));for(const label of ['Handicap Index','+1.2','provisional','Last round','72','3 Jun','Golf Ireland'])assert.ok(html.includes(label),label);
 assert.deepEqual(paths,['/api/golf-summary?club=Castle%20Golf%20Club&playerId=junior']);
});
test('failed or mismatched dependant summaries keep the card and navigation available',()=>{
 for(const resource of [{data:null,error:'Unavailable',loading:false},{data:null,error:'',loading:true},{data:{selectedPlayerId:'other',summary},error:'',loading:false},{data:{selectedPlayerId:'junior',summary:{...summary,player:{id:'other'}}},error:'',loading:false}]){
  const {DependantGolfCard,destinations}=load({resource:{...resource,reload(){}}});const element=DependantGolfCard({row}),html=renderToStaticMarkup(element);assert.match(html,/Casey Parker/);assert.match(html,/View My Golf/);assert.doesNotMatch(html,/\+1.2|72/);assert.ok(html.includes(resource.loading?'Loading golf summary':'Golf summary unavailable'));element.props.onPress();assert.equal(destinations[0].params.playerId,'junior');
 }
});
test('native dependant cards label sample data and empty round records',()=>{
 const {DependantGolfCard}=load({resource:{data:{selectedPlayerId:'junior',summary:{...summary,mode:'demo',recentRounds:[]}},loading:false,error:'',reload(){}}});const html=renderToStaticMarkup(React.createElement(DependantGolfCard,{row}));assert.match(html,/Sample golf data/);assert.match(html,/No round data yet/);
});

test('Home lesson and family panels use distinct identities when refreshing',()=>{const home=readFileSync('mobile/src/app/(tabs)/index.tsx','utf8');assert.match(home,/<NativeUpcomingLessonPanel key=\{`lessons:/);assert.match(home,/<NativeDependantPanel key=\{`family:/);});
