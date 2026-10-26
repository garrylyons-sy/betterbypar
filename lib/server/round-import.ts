import type {GolfSummaryRequest} from '@/lib/golf-summary';
import {getGolfSummary,golfIrelandDataMode} from '@/lib/server/golf-ireland';
import {getLiveGolfRound} from '@/lib/server/golf-ireland-isv';
export async function importGolfRound(request:GolfSummaryRequest,scoreUID:string){
 const mode=golfIrelandDataMode();
 if(mode==='live')return getLiveGolfRound(request,scoreUID);
 if(mode!=='demo')throw new Error('Golf Ireland is not connected yet.');
 const summary=await getGolfSummary(request),score=summary.recentRounds.find(r=>r.id===scoreUID);
 if(!score)throw new Error('Choose a recent round for this player.');
 const pars=[4,4,3,5,4,4,3,5,4,4,3,5,4,4,3,5,4,4],base=pars.reduce((a,b)=>a+b,0),extra=(score.grossScore??base)-base;
 const holes=pars.map((par,i)=>({number:i+1,par,strokes:par+Math.floor(extra/18)+(i<extra%18?1:0),putts:i===2?3:2,penalties:0,status:'played',comment:'',shots:[]}));
 return {source:'demo_golf_ireland' as const,externalScoreUid:score.id,importedGross:score.grossScore,importedPoints:score.stablefordPoints,data:{courseName:score.courseName,teeName:score.teeName,playedOn:score.date.slice(0,10),holeCount:18,format:'strokes',status:'completed',commentary:'',handicapIndex:summary.handicapIndex,playingHandicap:null,holes,imported:true}};
}
