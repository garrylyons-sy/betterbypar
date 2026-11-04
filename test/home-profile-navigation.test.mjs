import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
test('native Home profile button opens the native profile directly with avatar fallback',()=>{
 const exports={},destinations=[],jsx=(type,props)=>({type,props});
 const deps={react:{useState:v=>[v,()=>{}]},'react-native':{Image:'Image',Pressable:'Pressable'},'react/jsx-runtime':{jsx,jsxs:jsx},'@expo/vector-icons':{Ionicons:'Icon'},'expo-router':{router:{navigate:to=>destinations.push(to)}},'../lib/session':{useSession:()=>({session:{user:{profileImage:''}},origin:'https://www.betterbypar.com'})},'../lib/theme':{useTheme:()=>({})}};
 new Function('require','exports',ts.transpileModule(readFileSync('mobile/src/components/profile-button.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(id=>deps[id],exports);
 const button=exports.ProfileButton({});assert.equal(button.props.accessibilityLabel,'My profile and personal details');button.props.onPress();assert.deepEqual(destinations,['/profile']);assert.equal(button.props.children.type,'Icon');
});
test('profile access lives in Home headers instead of More cards for players and professionals',()=>{
 const read=p=>readFileSync(p,'utf8');
 assert.match(read('mobile/src/app/(tabs)/index.tsx'),/<Page showProfile/);
 assert.match(read('mobile/src/components/native-coach-workspace.tsx'),/showProfile=\{section==='home'\}/);
 assert.match(read('components/app-shell.tsx'),/href="\/profile" aria-label="My profile and personal details"/);
 for(const p of ['mobile/src/app/(tabs)/more.tsx','components/golf-home.tsx','components/professional-home.tsx'])assert.doesNotMatch(read(p),/title="My profile"|label:'My profile'/);
});
