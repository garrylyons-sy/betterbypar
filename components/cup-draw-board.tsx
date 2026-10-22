"use client";
import type {ReactNode} from 'react';
import {ArrowRight,CalendarDays,LockKeyhole,Sparkles,Trophy} from 'lucide-react';
import {cupDrawPresentation,type DrawSnapshot} from '@/lib/cup-draw-presentation.mjs';
const roundDate=(date:string)=>new Date(`${date}T12:00:00`).toLocaleDateString('en-IE',{day:'numeric',month:'short'});

export function CupDrawBoard({snapshot,revealedCount=Infinity,spotlight=false,controls}:{snapshot:DrawSnapshot;revealedCount?:number;spotlight?:boolean;controls?:ReactNode}){
 const view=cupDrawPresentation(snapshot,revealedCount),latest=view.latestPairing;
 return <div className="min-w-0 space-y-4">
  {spotlight?<p className="sr-only" aria-live="polite" aria-atomic="true">{latest?`${latest.roundName}, match ${latest.number}: ${latest.home} versus ${latest.away}.`:'Ready to reveal the first pairing.'}</p>:null}
  {spotlight?<section aria-label={latest?'Latest pairing':'Draw stage'} className="cup-draw-stage relative overflow-hidden rounded-2xl border border-teal-700/40 bg-[#071b24] px-4 py-6 text-white sm:px-6 sm:py-8">
   <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl" aria-hidden="true"/>
   <div className="relative text-center"><p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-200"><Sparkles className="h-4 w-4" aria-hidden="true"/>{latest?`${latest.roundName} · Match ${latest.number}`:'The stage is set'}</p>
    {latest?<div key={`${latest.roundNumber}-${latest.matchNumber}`} className="cup-draw-reveal mt-5 grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
     <div className="min-w-0"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-teal-200">Home</p><p className="break-words text-2xl font-black leading-tight sm:text-3xl">{latest.home}</p>{latest.homeBye?<p className="mt-2 text-xs text-amber-200">Through on a bye</p>:null}</div>
     <div className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-amber-200/40 bg-amber-200/10 text-sm font-black italic text-amber-100" aria-label="versus">VS</div>
     <div className="min-w-0"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-teal-200">Away</p><p className="break-words text-2xl font-black leading-tight sm:text-3xl">{latest.away}</p>{latest.awayBye?<p className="mt-2 text-xs text-amber-200">Through on a bye</p>:null}</div>
    </div>:<div className="py-5"><div className="mb-4 flex items-center justify-center gap-5" aria-hidden="true"><span className="cup-draw-ball">?</span><span className="text-xs font-black tracking-[0.2em] text-teal-200">VS</span><span className="cup-draw-ball cup-draw-ball-gold">?</span></div><h4 className="text-xl font-black">Ready for the first pairing</h4><p className="mt-2 text-sm text-teal-100/80">Reveal one match at a time and watch the road to the final unfold.</p></div>}
    {latest?<p className="mt-5 inline-flex items-center gap-2 text-xs text-teal-100/80"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true"/>{roundDate(latest.date)}</p>:null}
   </div>
  </section>:null}
  {controls}
  <div className="flex items-center justify-between gap-3"><h4 className="flex items-center gap-2 text-sm font-black text-[#10233f]"><Trophy className="h-4 w-4 text-amber-600" aria-hidden="true"/>Road to the final</h4><span className="text-xs text-slate-500">{view.rounds.length} rounds</span></div>
  <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Round progression">{view.rounds.map((round,index)=><div key={round.roundNumber} className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold ${index===view.rounds.length-1?'bg-amber-100 text-amber-900':'bg-slate-100 text-slate-700'}`}>{round.name}</span>{index<view.rounds.length-1?<ArrowRight className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true"/>:null}</div>)}</div>
  {revealedCount===0?<p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">The bracket fills in as each match is revealed.</p>:<div className="grid min-w-0 gap-4 lg:flex lg:items-start lg:overflow-x-auto lg:pb-3" aria-label="Draw bracket">{view.rounds.map((round,index)=>{
   const final=index===view.rounds.length-1;
   return <section key={round.roundNumber} aria-label={round.name} className={`min-w-0 rounded-xl border bg-white lg:w-64 lg:shrink-0 ${final?'border-amber-300':'border-slate-200'}`}>
    <header className={`flex items-center justify-between gap-3 rounded-t-xl border-b px-3 py-3 ${final?'border-amber-200 bg-amber-50':'border-slate-200 bg-slate-50'}`}><div className="min-w-0"><h5 className="text-sm font-black text-slate-900">{round.name}</h5><p className="mt-0.5 text-xs text-slate-500">{roundDate(round.date)}</p></div>{final?<Trophy className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true"/>:<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-black text-slate-600">{round.roundNumber}</span>}</header>
    <ol className="grid gap-2 p-3">{round.ties.map(tie=>{
     const current=spotlight&&latest?.roundNumber===round.roundNumber&&latest.matchNumber===tie.matchNumber;
     return <li key={tie.matchNumber} className={`relative rounded-xl border p-3 ${current?'border-teal-500 bg-teal-50 ring-1 ring-teal-500/20':tie.revealState==='hidden'?'border-dashed border-slate-200 bg-slate-50':'border-slate-200 bg-white'}`}>
      <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{round.roundNumber===1&&view.byes?'Preliminary match':'Match'} {String(tie.number).padStart(2,'0')}</span>{current?<span className="rounded-full bg-teal-700 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">Just drawn</span>:tie.revealState==='hidden'?<LockKeyhole className="h-3 w-3 text-slate-400" aria-label="Awaiting reveal"/>:null}</div>
      {tie.revealState==='hidden'?<div className="space-y-2 py-1"><p className="text-xs font-semibold text-slate-400">Team not revealed</p><div className="h-px bg-slate-200"/><p className="text-xs font-semibold text-slate-400">Team not revealed</p></div>:<><p className="break-words text-sm font-extrabold leading-snug text-slate-900">{tie.home}{tie.homeBye?<span className="ml-1 text-[10px] font-bold text-teal-700">(bye)</span>:null}</p><div className="my-2 flex items-center gap-2"><span className="h-px flex-1 bg-slate-100"/><span className="text-[9px] font-black uppercase text-slate-400">v</span><span className="h-px flex-1 bg-slate-100"/></div><p className="break-words text-sm font-extrabold leading-snug text-slate-900">{tie.away}{tie.awayBye?<span className="ml-1 text-[10px] font-bold text-teal-700">(bye)</span>:null}</p></>}
     </li>;
    })}</ol>
   </section>;
  })}</div>}
 </div>;
}
