import {createHash} from 'node:crypto';
import type {GolfSummary,GolfSummaryRequest} from '@/lib/golf-summary';
import {getLiveGolfSummary} from '@/lib/server/golf-ireland-isv';
export function golfIrelandDataMode(env:Record<string,string|undefined>=process.env):'demo'|'live'|'off'{
 if(env.LOCAL_DEMO==='1')return 'demo';
 const mode=env.GOLF_IRELAND_DATA_MODE??(env.NODE_ENV==='production'?'off':'demo');
 if(!['demo','live','off'].includes(mode))throw new Error('Golf data is not configured.');
 return mode as 'demo'|'live'|'off';
}
const isoDay=(now:Date,ago:number)=>{const date=new Date(now);date.setUTCDate(date.getUTCDate()-ago);return date.toISOString().slice(0,10);};
export function demoGolfSummary(request:GolfSummaryRequest,now=new Date()):GolfSummary{
 const seed=createHash('sha256').update(request.golfIrelandNumber).digest().readUInt16BE(0);
 const fixture:Record<string,number>={'9990000001':12.4,'9990000002':18.3,'9990000003':9.6,'9990000004':17.2,'9990000005':27.8};
 const index=fixture[request.golfIrelandNumber]??Math.round((8+seed%200/10)*10)/10;
 const roundOffsets=[3,10,17],differentials=[index-1.3,index+1.7,index+1.0],previous=Math.round((index+.7)*10)/10;
 return {mode:'demo',player:{id:request.playerId,name:request.playerName,golfIrelandNumber:request.golfIrelandNumber,homeClub:request.clubName},
  handicapIndex:index,handicapDisplay:index.toFixed(1),handicapStatus:'active',previousHandicapIndex:previous,lowHandicapIndex:Math.round((index-.6)*10)/10,lastUpdatedAt:now.toISOString(),
  history:[35,28,21,17,10,3].map((offset,i)=>({date:isoDay(now,offset),index:Math.round((index+[1.4,1.2,1.0,.9,.8,.7][i])*10)/10})).concat({date:isoDay(now,0),index}),
  recentRounds:roundOffsets.map((ago,i)=>({id:`demo-${request.playerId}-${i}`,date:isoDay(now,ago),courseName:i===1?'Woodland Golf Club':request.clubName,teeName:'White tees',holes:18,
   grossScore:72+Math.round(differentials[i]),stablefordPoints:[37,32,34][i],scoreDifferential:Math.round(differentials[i]*10)/10,counting:i!==1})),
  notice:'Sample golf data for this registered player. Scores and handicap values are illustrative and have not been retrieved from Golf Ireland.'};
}
export async function getGolfSummary(request:GolfSummaryRequest,options:{env?:Record<string,string|undefined>;now?:Date}={}):Promise<GolfSummary>{
 const mode=golfIrelandDataMode(options.env);
 if(mode==='demo')return demoGolfSummary(request,options.now);
 if(mode==='live')return getLiveGolfSummary(request,options);
 return {mode:'unavailable',player:{id:request.playerId,name:request.playerName,golfIrelandNumber:request.golfIrelandNumber,homeClub:request.clubName},handicapIndex:null,handicapDisplay:null,handicapStatus:'active',previousHandicapIndex:null,lowHandicapIndex:null,lastUpdatedAt:null,history:[],recentRounds:[],notice:'Golf Ireland is not connected yet.'};
}
