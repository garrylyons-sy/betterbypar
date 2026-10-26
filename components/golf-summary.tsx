'use client';

import {useEffect, useId, useState} from 'react';
import {ArrowDownRight, ArrowUpRight, Flag, RefreshCw, CheckCircle2, CircleMinus, CircleHelp} from 'lucide-react';

type Player = {id:string;name:string;isSelf:boolean};
type Round = {id:string;date:string;courseName:string;teeName:string;holes:number|null;grossScore:number|null;stablefordPoints:number|null;scoreDifferential:number|null;counting:boolean|null};
type Summary = {
  mode:'demo'|'live'|'unavailable';
  player:{id:string;name:string;golfIrelandNumber:string;homeClub:string};
  handicapIndex:number|null;handicapDisplay?:string|null;handicapStatus?:'active'|'pending'|'withdrawn'|'provisional'|'frozen';previousHandicapIndex:number|null;lowHandicapIndex:number|null;lastUpdatedAt:string|null;
  history:{date:string;index:number}[];recentRounds:Round[];notice:string|null;
};
type Payload = {players:Player[];selectedPlayerId:string|null;summary:Summary|null};
type Resource = {clubName:string;playerId:string;data:Payload|null;error:string|null};
const availableNumber = (value:number|null|undefined):value is number => typeof value==='number' && Number.isFinite(value);
const indexLabel = (value:number|null|undefined) => availableNumber(value) ? `${value < 0 ? '+' : ''}${Math.abs(value).toFixed(1)}` : 'Not available';
function dateLabel(value:string|null) {
  if(!value)return 'Not available';
  const date=new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-IE',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Dublin'}) : 'Not available';
}

export function GolfSummary({clubName,selfOnly=false}:{clubName:string;selfOnly?:boolean}) {
  const [selection,setSelection]=useState({clubName,playerId:''});
  const [resource,setResource]=useState<Resource|null>(null);
  const [revision,setRevision]=useState(0);
  const headingId=useId();
  const requestedPlayerId=!selfOnly&&selection.clubName===clubName ? selection.playerId : '';
  useEffect(()=>{
    const controller=new AbortController();
    let active=true;
    setResource({clubName,playerId:requestedPlayerId,data:null,error:null});
    const params=new URLSearchParams({club:clubName});
    if(requestedPlayerId)params.set('playerId',requestedPlayerId);
    void fetch(`/api/golf-summary?${params}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(async response=>{
        const data=await response.json();
        if(!response.ok){
          if(Array.isArray(data.players)){
            if(active)setResource({clubName,playerId:requestedPlayerId,data,error:data.error || 'Your golf summary could not be loaded.'});
            return;
          }
          throw new Error(data.error || 'Your golf summary could not be loaded.');
        }
        if(active)setResource({clubName,playerId:requestedPlayerId,data,error:null});
      })
      .catch(error=>{
        if(active)setResource({clubName,playerId:requestedPlayerId,data:null,error:error instanceof Error ? error.message : 'Your golf summary could not be loaded.'});
      });
    return ()=>{active=false;controller.abort();};
  },[clubName,requestedPlayerId,revision]);
  const current=resource?.clubName===clubName && resource.playerId===requestedPlayerId ? resource : null;
  const data=current?.data;
  if(data && (!data.players.length||(selfOnly&&!data.players.some(player=>player.isSelf&&player.id===data.selectedPlayerId))))return null;
  const summary=data?.summary;
  const demo=summary?.mode==='demo';
  const handicapDisplay=summary?.handicapDisplay ?? (demo && availableNumber(summary?.handicapIndex) ? indexLabel(summary.handicapIndex) : '—');
  const rounds=[...(summary?.recentRounds ?? [])].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,3);
  const movement=summary && availableNumber(summary.handicapIndex) && availableNumber(summary.previousHandicapIndex)
    ? Math.round((summary.previousHandicapIndex-summary.handicapIndex)*10)/10 : null;
  return <section aria-labelledby={headingId} className="golf-overview">
    <header className="golf-overview-heading">
      <h2 id={headingId}>Your golf</h2>
      {demo && <span className="golf-demo-badge">Sample data</span>}
      {!selfOnly && data && data.players.length>1 && <label className="golf-player-select">Player<select value={data.selectedPlayerId ?? ''} onChange={event=>setSelection({clubName,playerId:event.target.value})}>{data.players.map(player=><option key={player.id} value={player.id}>{player.name}{player.isSelf?' (you)':''}</option>)}</select></label>}
    </header>
    {!current || (!data && !current.error) ? <div role="status" className="p-5">Loading your golf…</div> : current.error ? <div className="space-y-3 p-5"><p role="alert">{current.error}</p><button type="button" onClick={()=>setRevision(value=>value+1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--club-border)] px-4 text-sm font-bold"><RefreshCw className="h-4 w-4"/>Try again</button></div> : !summary ? <p className="p-5">No golf summary is available yet.</p> : <>
      <div className="golf-summary-layout">
        <div className="golf-handicap-card">
          <div aria-hidden="true" className="golf-card-orbits"/>
          <div className="golf-player-heading"><div><p className="golf-player-name">{summary.player.name}</p><p className="golf-hero-muted">{summary.player.homeClub || clubName}</p></div><Flag aria-hidden="true" className="h-5 w-5 opacity-70"/></div>
          <div className="golf-handicap-values">
            <div><h3 className="golf-metric-label">Handicap Index</h3><p className="golf-index-number" aria-label={`Handicap Index: ${handicapDisplay==='—'?'Not available':handicapDisplay}`}>{handicapDisplay}</p>{summary.handicapStatus && summary.handicapStatus!=='active' && <p className="mt-1 text-xs font-bold capitalize">{summary.handicapStatus}</p>}</div>
            {availableNumber(summary.lowHandicapIndex) && <div className="golf-low-index"><p className="golf-metric-label">Low index</p><p>{indexLabel(summary.lowHandicapIndex)}</p></div>}
          </div>
          {movement!==null && <p className="golf-movement">{movement>0?<ArrowDownRight aria-hidden="true" className="h-4 w-4"/>:movement<0?<ArrowUpRight aria-hidden="true" className="h-4 w-4"/>:null}<span>{movement>0?`${movement.toFixed(1)} better`:movement<0?`${Math.abs(movement).toFixed(1)} higher`:'Unchanged'} <span className="golf-hero-muted">since last round</span></span></p>}
          <HandicapTrend history={summary.history} demo={demo}/>
        </div>
        <div className="golf-rounds-panel">
          <div className="golf-rounds-heading"><h3>Recent rounds</h3><span>Last {rounds.length || 3}</span></div>
          {rounds.length ? <ol className="golf-round-list">{rounds.map(round=><li key={round.id} className="golf-round-card">
            <div className="golf-round-score"><span className="golf-score-label">Gross</span><strong>{availableNumber(round.grossScore)?round.grossScore:'—'}</strong></div>
            <div className="golf-round-info"><p className="golf-round-course">{round.courseName || 'Course unavailable'}</p><p className="golf-round-meta">{dateLabel(round.date).replace(/ \d{4}$/, '')}{round.holes?` · ${round.holes} holes`:''}{round.teeName?` · ${round.teeName}`:''}</p><dl className="golf-round-stats"><div><dt>Differential</dt><dd>{availableNumber(round.scoreDifferential)?round.scoreDifferential.toFixed(1):'—'}</dd></div>{availableNumber(round.stablefordPoints)&&<div><dt>Points</dt><dd>{round.stablefordPoints}</dd></div>}</dl></div>
            <CountingIcon counting={round.counting}/>
          </li>)}</ol> : <p className="rounded-xl border border-dashed border-[var(--club-border)] p-5 text-sm">No recent rounds available.</p>}
          {rounds.length>0 && <div className="golf-counting-legend" aria-label="Handicap counting legend"><span><CountingIcon counting={true}/>Counting</span><span><CountingIcon counting={false}/>Not counting</span>{rounds.some(round=>round.counting===null)&&<span><CountingIcon counting={null}/>Unknown</span>}</div>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3"><a href="/my-golf?new=1" className="rounded-xl bg-[var(--club-primary)] px-4 py-3 text-xs font-bold text-[var(--club-on-primary)]">Record a round</a><a href="/my-golf" className="py-3 text-xs font-bold underline">My rounds & coaching →</a></div>
      <details className="golf-data-details"><summary>Data details{demo?' · demo':''}</summary><div><p>Golf Ireland number: {summary.player.golfIrelandNumber || 'Not available'}</p><p>{summary.lastUpdatedAt ? `${demo?'Sample data as of':'Data as of'} ${dateLabel(summary.lastUpdatedAt)}` : 'Update date unavailable'}</p>{summary.notice&&<p>{summary.notice}</p>}{demo&&<p>Golf Ireland is not connected. All handicap values and rounds shown here are illustrative.</p>}</div></details>
    </>}
  </section>;
}

function CountingIcon({counting}:{counting:boolean|null}){
  const label=counting===true?'Counting towards Handicap Index':counting===false?'Not counting towards Handicap Index':'Counting status unavailable';
  const Icon=counting===true?CheckCircle2:counting===false?CircleMinus:CircleHelp;
  return <span role="img" aria-label={label} title={label} className={`golf-counting-icon ${counting===true?'is-counting':''}`}><Icon aria-hidden="true" className="h-4 w-4"/></span>;
}

function HandicapTrend({history,demo}:{history:Summary['history'];demo:boolean}) {
  const titleId=useId(),gradientId=useId();
  const points=history.filter(point=>availableNumber(point.index)&&Number.isFinite(new Date(point.date).getTime())).sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime());
  if(points.length<2)return null;
  const min=Math.min(...points.map(point=>point.index)),max=Math.max(...points.map(point=>point.index)),range=Math.max(1,max-min);
  const coords=points.map((point,index)=>({x:8+index/(points.length-1)*304,y:8+(max-point.index)/range*42}));
  const line=coords.map(point=>`${point.x},${point.y}`).join(' ');
  return <div className="golf-trend"><div className="golf-trend-heading"><h3>Index trend</h3><span>{indexLabel(points[0].index)} → {indexLabel(points.at(-1)!.index)}</span></div><svg viewBox="0 0 320 64" role="img" aria-labelledby={titleId}><title id={titleId}>{demo?'Sample ':''}Recent index history from {indexLabel(points[0].index)} on {dateLabel(points[0].date)} to {indexLabel(points.at(-1)!.index)} on {dateLabel(points.at(-1)!.date)}. Lower is better.</title><defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop stopColor="currentColor" stopOpacity=".2"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><polygon points={`8,64 ${line} 312,64`} fill={`url(#${gradientId})`}/><polyline points={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>{coords.map((point,index)=><circle key={index} cx={point.x} cy={point.y} r={index===coords.length-1?4:2.5} fill="currentColor"/>)}</svg><p className="golf-trend-dates"><span>{dateLabel(points[0].date).replace(/ \d{4}$/, '')}</span><span>{dateLabel(points.at(-1)!.date).replace(/ \d{4}$/, '')}</span></p></div>;
}
