import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {localDemoEnvironment} from '../lib/local-demo.mjs';
import {initializeLocalDemo} from './local-demo-database.mjs';

const appPort=3500,dbPort=55432;
await mkdir(new URL('../.local-demo',import.meta.url),{recursive:true});
const db=await PGlite.create({dataDir:fileURLToPath(new URL('../.local-demo/postgres',import.meta.url)),extensions:{btree_gist,pgcrypto}});
await initializeLocalDemo(db);
const server=new PGLiteSocketServer({db,host:'127.0.0.1',port:dbPort,maxConnections:128});
await server.start();
console.log(`Local demo database ready. Open http://127.0.0.1:${appPort}/demo`);
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(appPort)],{
  cwd:new URL('..',import.meta.url),stdio:'inherit',env:localDemoEnvironment(process.env,appPort,dbPort)
});
let stopping=false;
async function stop(code=0){if(stopping)return;stopping=true;child.kill('SIGTERM');await server.stop();await db.close();process.exit(code);}
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());child.on('exit',code=>void stop(code??0));
