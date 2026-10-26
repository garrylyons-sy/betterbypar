'use client';

import {useEffect, useId, useState} from 'react';
import {ArrowDownRight, ArrowUpRight, Flag, RefreshCw} from 'lucide-react';

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

export function GolfSummary({clubName}:{clubName:string}) {
  const [selection,setSelection]=useState({clubName,playerId:''});
  const [resource,setResource]=useState<Resource|null>(null);
  const [revision,setRevision]=useState(0);
  const headingId=useId();
  const requestedPlayerId=selection.clubName===clubName ? selection.playerId : '';
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
  if(data && !data.players.length)return null;
  const summary=data?.summary;
  const demo=summary?.mode==='demo';
  const handicapDisplay=summary?.handicapDisplay ?? (demo && availableNumber(summary?.handicapIndex) ? indexLabel(summary.handicapIndex) : '—');
  const rounds=[...(summary?.recentRounds ?? [])].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,3);
  const movement=summary && availableNumber(summary.handicapIndex) && availableNumber(summary.previousHandicapIndex)
    ? Math.round((summary.previousHandicapIndex-summary.handicapIndex)*10)/10 : null;
  return <section aria-labelledby={headingId} className="overflow-hidden rounded-2xl border border-[var(--club-border)] bg-[var(--club-surface)] text-[var(--club-text)]">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--club-border)] px-5 py-4 sm:px-6">
      <h2 id={headingId} className="text-lg font-extrabold">Your golf</h2>
      {demo ? <span className="rounded-full border border-[var(--club-border)] bg-[var(--club-soft)] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide">Demo · sample data</span> : null}
      {data && data.players.length>1 ? <label className="grid max-w-full gap-1 text-xs font-bold text-[var(--club-muted-text)]">Player<select className="min-h-11 max-w-full rounded-xl border border-[var(--club-border)] bg-[var(--club-surface)] px-3 text-base font-bold text-[var(--club-text)]" value={data.selectedPlayerId ?? ''} onChange={event=>setSelection({clubName,playerId:event.target.value})}>{data.players.map(player=><option key={player.id} value={player.id}>{player.name}{player.isSelf?' (you)':''}</option>)}</select></label> : null}
    </div>
    {!current || (!data && !current.error) ? <div role="status" className="space-y-4 p-5 sm:p-6"><p className="text-sm text-[var(--club-muted-text)]">Loading your golf summary…</p><div aria-hidden="true" className="h-28 animate-pulse rounded-xl bg-[var(--club-soft)]"/></div> : current.error ? <div className="space-y-3 p-5 sm:p-6"><p role="alert" className="text-sm text-[var(--club-muted-text)]">{current.error}</p><button type="button" onClick={()=>setRevision(value=>value+1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--club-border)] px-4 text-sm font-bold"><RefreshCw className="h-4 w-4"/>Try again</button></div> : !summary ? <p className="p-5 text-sm text-[var(--club-muted-text)]">No golf summary is available for this player yet.</p> : <>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
        <div>
          <p className="text-sm font-bold">{summary.player.name}</p>
          <p className="mt-1 text-xs text-[var(--club-muted-text)]">{summary.player.homeClub || clubName} · Golf Ireland {summary.player.golfIrelandNumber || 'number not available'}</p>
          <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div><h3 className="text-xs font-bold uppercase tracking-[.12em] text-[var(--club-muted-text)]">Handicap Index</h3><p className="mt-1 text-[88px] font-black leading-none tracking-[-.065em] text-[var(--club-primary-text)] sm:text-[96px]" aria-label={`Handicap Index: ${handicapDisplay==='—'?'Not available':handicapDisplay}`}>{handicapDisplay}</p>{summary.handicapStatus && summary.handicapStatus!=='active' ? <p className="mt-2 text-xs font-bold capitalize text-[var(--club-muted-text)]">{summary.handicapStatus} Handicap Index</p> : null}</div>
            {availableNumber(summary.lowHandicapIndex) ? <div className="mb-1 rounded-xl border border-[var(--club-border)] bg-[var(--club-soft)] px-4 py-3"><p className="max-w-24 text-xs font-semibold leading-4 text-[var(--club-muted-text)]">Low Handicap Index</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{indexLabel(summary.lowHandicapIndex)}</p></div> : null}
          </div>
          {movement!==null ? <p className="mt-4 flex items-start gap-1.5 text-sm font-semibold">{movement>0?<ArrowDownRight aria-hidden="true" className="h-5 w-5 shrink-0"/>:movement<0?<ArrowUpRight aria-hidden="true" className="h-5 w-5 shrink-0"/>:null}<span>{movement>0?`Improved by ${movement.toFixed(1)}`:movement<0?`Increased by ${Math.abs(movement).toFixed(1)}`:'Unchanged'} <span className="font-normal text-[var(--club-muted-text)]">since last recorded round</span></span></p> : null}
          <p className="mt-3 text-xs text-[var(--club-muted-text)]">{summary.lastUpdatedAt ? `${demo?'Sample data as of':'Data as of'} ${dateLabel(summary.lastUpdatedAt)}` : 'Update date not available'}</p>
          {summary.notice ? <p className="mt-3 text-xs leading-5 text-[var(--club-muted-text)]">{summary.notice}</p> : null}
          <HandicapTrend history={summary.history} demo={demo}/>
        </div>
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-extrabold">Last 3 rounds</h3>{demo ? <span className="text-xs font-semibold text-[var(--club-muted-text)]">Sample rounds</span> : null}</div>
          {rounds.length ? <ol className="grid gap-3">{rounds.map(round=><li key={round.id} className="rounded-xl border border-[var(--club-border)] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-extrabold">{round.courseName || 'Course not available'}</p><p className="mt-1 text-xs text-[var(--club-muted-text)]">{dateLabel(round.date)}{round.teeName?` · ${round.teeName}`:''}{round.holes?` · ${round.holes} holes`:''}</p></div><Flag aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--club-muted-text)]"/></div><dl className="mt-4 grid grid-cols-2 gap-3"><div><dt className="text-xs text-[var(--club-muted-text)]">Gross score</dt><dd className="mt-1 text-lg font-extrabold tabular-nums">{availableNumber(round.grossScore)?round.grossScore:'Not available'}</dd></div><div><dt className="text-xs text-[var(--club-muted-text)]">Score differential</dt><dd className="mt-1 text-lg font-extrabold tabular-nums">{availableNumber(round.scoreDifferential)?round.scoreDifferential.toFixed(1):'Not available'}</dd></div>{availableNumber(round.stablefordPoints)?<div className="col-span-2 flex justify-between gap-3 text-xs"><dt className="text-[var(--club-muted-text)]">Stableford points</dt><dd className="font-bold tabular-nums">{round.stablefordPoints}</dd></div>:null}</dl><p className="mt-3 border-t border-[var(--club-border)] pt-2 text-[11px] font-semibold text-[var(--club-muted-text)]">{round.counting===true?'Counting towards Handicap Index':round.counting===false?'Not counting towards Handicap Index':'Handicap Index counting status not available'}</p></li>)}</ol> : <p className="rounded-xl border border-dashed border-[var(--club-border)] p-5 text-sm text-[var(--club-muted-text)]">Recent rounds are not available yet.</p>}
        </div>
      </div>
    </>}
  </section>;
}

function HandicapTrend({history,demo}:{history:Summary['history'];demo:boolean}) {
  const titleId=useId();
  const points=history.filter(point=>availableNumber(point.index)&&Number.isFinite(new Date(point.date).getTime())).sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime());
  if(points.length<2)return null;
  const min=Math.min(...points.map(point=>point.index));
  const max=Math.max(...points.map(point=>point.index));
  const range=Math.max(1,max-min);
  const coords=points.map((point,index)=>({x:10+index/(points.length-1)*300,y:12+(max-point.index)/range*56}));
  return <div className="mt-5 border-t border-[var(--club-border)] pt-4"><h3 className="text-xs font-bold text-[var(--club-muted-text)]">{demo?'Sample recent index history':'Recent index history'}</h3><svg viewBox="0 0 320 82" role="img" aria-labelledby={titleId} className="mt-2 h-24 w-full text-[var(--club-primary-text)]"><title id={titleId}>{demo?'Sample ':''}Recent index history from {indexLabel(points[0].index)} on {dateLabel(points[0].date)} to {indexLabel(points.at(-1)!.index)} on {dateLabel(points.at(-1)!.date)}. Lower is better.</title><line x1="10" y1="74" x2="310" y2="74" stroke="var(--club-border)"/><polyline points={coords.map(point=>`${point.x},${point.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>{coords.map((point,index)=><circle key={index} cx={point.x} cy={point.y} r="3" fill="var(--club-surface)" stroke="currentColor" strokeWidth="2"/>)}</svg><p className="flex justify-between gap-3 text-[11px] text-[var(--club-muted-text)]"><span>{dateLabel(points[0].date)} · {indexLabel(points[0].index)}</span><span>{dateLabel(points.at(-1)!.date)} · {indexLabel(points.at(-1)!.index)}</span></p></div>;
}
