const availableNumber=value=>typeof value==='number'&&Number.isFinite(value);
export const indexLabel=value=>availableNumber(value)?`${value<0?'+':''}${Math.abs(value).toFixed(1)}`:'—';
export function dateLabel(value,short=false){
 if(!value)return 'Not available';
 const date=new Date(value);
 return Number.isFinite(date.getTime())?date.toLocaleDateString('en-IE',{day:'numeric',month:'short',...(short?{}:{year:'numeric'}),timeZone:'Europe/Dublin'}):'Not available';
}
export const countingLabel=value=>value===true?'Counting towards Handicap Index':value===false?'Not counting towards Handicap Index':'Counting status unavailable';
export function trendPoints(history=[]){
 const points=history.filter(p=>availableNumber(p.index)&&Number.isFinite(new Date(p.date).getTime())).slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
 if(points.length<2)return [];
 const min=Math.min(...points.map(p=>p.index)),max=Math.max(...points.map(p=>p.index)),range=Math.max(1,max-min);
 return points.map((p,i)=>({...p,x:8+i/(points.length-1)*304,y:8+(max-p.index)/range*42}));
}
export function golfSummaryView(summary){
 const rounds=(summary?.recentRounds??[]).filter(r=>Number.isFinite(new Date(r.date).getTime())).slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,3);
 const movement=availableNumber(summary?.handicapIndex)&&availableNumber(summary?.previousHandicapIndex)?Math.round((summary.previousHandicapIndex-summary.handicapIndex)*10)/10:null;
 return {handicap:summary?.handicapDisplay??(summary?.mode==='demo'?indexLabel(summary.handicapIndex):'—'),rounds,movement,
 movementLabel:movement===null?null:movement>0?`${movement.toFixed(1)} better`:movement<0?`${Math.abs(movement).toFixed(1)} higher`:'Unchanged',
 hasUnknownCounting:rounds.some(r=>r.counting==null),trend:trendPoints(summary?.history)};
}
