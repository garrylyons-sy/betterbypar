// Exercises actual draw workflow + fixture publication in one rolled-back transaction.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as draw from '../lib/server/cup-draw.mjs';
const require=createRequire(import.meta.url),ts=require('typescript'),{Pool}=require('pg');
for(const file of ['.env.local','.env'])if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
const client=await pool.connect();
function load(file,deps){const compiled=ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const api={};new Function('require','exports',compiled)(name=>deps[name]??require(name),api);return api;}
const publication=load('../lib/server/cup-competitions.ts',{});
const workflow=load('../lib/server/cup-draw-workflow.ts',{'@/lib/server/cup-draw.mjs':draw,'@/lib/server/cup-competitions':publication});
try{
 await client.query('begin');
 const actor=(await client.query('select person_id from public.app_operator where active limit 1')).rows[0].person_id;
 const teams=(await client.query(`select t.id,t.season_id from public.team t where t.active and (select count(*) from public.team other where other.active and other.season_id=t.season_id)>=3 order by t.season_id,t.id limit 3`)).rows;
 assert.equal(teams.length,3);assert.equal(teams[0].season_id,teams[2].season_id);
 const cup=(await client.query("insert into public.cup_competition(season_id,name,round_count,created_by) values($1,'Draw verification '||gen_random_uuid(),2,$2) returning id",[teams[0].season_id,actor])).rows[0].id;
 for(const t of teams)await client.query('insert into public.cup_competition_entry(competition_id,team_id) values($1,$2)',[cup,t.id]);
 for(let n=1;n<=2;n++)await client.query("insert into public.cup_competition_round(competition_id,round_number,name,fixture_date) values($1,$2,$3,current_date+($2::int*7))",[cup,n,n===1?'Semi Final':'Final']);
 await client.query("insert into public.cup_competition_format_slot(competition_id,slot_number,game_type) values($1,1,'Singles')",[cup]);
 const fixtureCount=async()=>Number((await client.query('select count(*) as n from public.cup_competition_tie t join public.cup_competition_round r on r.id=t.competition_round_id where r.competition_id=$1',[cup])).rows[0].n);
 let a=await workflow.changeCupDraw(client,cup,actor,{action:'draw'});
 assert.equal(await fixtureCount(),0);
 const oldSnapshot=structuredClone(a.snapshot);
 a=await workflow.changeCupDraw(client,cup,actor,{action:'redraw',attemptId:a.id,reason:'Witness requested a restart'});
 assert.equal(a.attempt_number,2);assert.equal(await fixtureCount(),0);
 const prior=(await client.query('select * from public.cup_draw_attempt where competition_id=$1 and attempt_number=1',[cup])).rows[0];
 assert.equal(prior.status,'Superseded');assert.deepEqual(prior.snapshot,oldSnapshot);
 await assert.rejects(workflow.changeCupDraw(client,cup,actor,{action:'confirm',attemptId:prior.id,witnessName:'Witness'}),/changed/);
 for(let n=1;n<=2;n++)await workflow.changeCupDraw(client,cup,actor,{action:'reveal',attemptId:a.id,revealedCount:n});
 await workflow.changeCupDraw(client,cup,actor,{action:'reveal',attemptId:a.id,revealedCount:1}); // retry cannot hide already revealed matches
 assert.equal((await client.query('select revealed_count from public.cup_draw_attempt where id=$1',[a.id])).rows[0].revealed_count,2);
 assert.equal(await fixtureCount(),0);
 await client.query('savepoint failed_confirmation');
 const missingActor=(await client.query('select gen_random_uuid() as id')).rows[0].id;
 await assert.rejects(workflow.changeCupDraw(client,cup,missingActor,{action:'confirm',attemptId:a.id,witnessName:'Test Witness'}),/foreign key/);
 await client.query('rollback to savepoint failed_confirmation');
 assert.equal(await fixtureCount(),0);
 assert.equal((await client.query('select status from public.cup_draw_attempt where id=$1',[a.id])).rows[0].status,'Provisional');
 await workflow.changeCupDraw(client,cup,actor,{action:'confirm',attemptId:a.id,witnessName:'Test Witness'});
 const ties=(await client.query('select t.*,r.round_number from public.cup_competition_tie t join public.cup_competition_round r on r.id=t.competition_round_id where r.competition_id=$1 order by r.round_number,t.match_number',[cup])).rows;
 assert.equal(ties.length,3);
 for(const tie of ties.filter(t=>t.round_number===1)){const expected=a.snapshot.bracket.find(t=>t.roundNumber===1&&t.matchNumber===tie.match_number);assert.equal(tie.home_team_id,expected.homeTeamId);assert.equal(tie.away_team_id,expected.awayTeamId);assert.equal(Boolean(tie.fixture_id),expected.status!=='Bye');}
 const confirmed=(await client.query('select * from public.cup_draw_attempt where id=$1',[a.id])).rows[0];assert.equal(confirmed.witness_name,'Test Witness');assert.equal(confirmed.status,'Confirmed');
 await assert.rejects(workflow.changeCupDraw(client,cup,actor,{action:'redraw',attemptId:a.id,reason:'Forbidden'}),/confirmed/);
 const privileges=(await client.query("select has_table_privilege('anon','public.cup_draw_attempt','select') as anon_read,has_table_privilege('authenticated','public.cup_draw_attempt','select') as auth_read")).rows[0];
 assert.equal(privileges.anon_read,false);assert.equal(privileges.auth_read,false);
 console.log('Verified provisional draw, redraw history, byes, reveal retries, saved-pairing confirmation, fixture publication, failed-confirmation rollback, private history access and confirmed lock. All changes rolled back.');
}finally{await client.query('rollback');client.release();await pool.end();}
