import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import * as inbox from '../../lib/cup-draw-inbox.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=ts.transpileModule(readFileSync(new URL('../../components/cup-draw-inbox-message.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const api={};new Function('require','exports',source)(name=>name==='@/lib/cup-draw-inbox.mjs'?inbox:require(name),api);
export const CupDrawInboxMessage=api.CupDrawInboxMessage;
