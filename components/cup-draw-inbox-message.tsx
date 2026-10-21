"use client";

import { cupDrawInboxContent } from "@/lib/cup-draw-inbox.mjs";

export function CupDrawInboxMessage({body,onOpen}:{body:string;onOpen:()=>void}){
  const draw=cupDrawInboxContent(body);
  return <div className="mt-2 text-sm">
    <p className="text-slate-600">{draw.summary}</p>
    <details className="mt-3 rounded-lg border border-slate-200 bg-white" onToggle={event=>{if(event.currentTarget.open)onOpen();}}>
      <summary className="min-h-11 cursor-pointer px-3 py-3 font-bold text-teal-800">View draw</summary>
      <div className="space-y-4 border-t border-slate-100 p-3">
        {draw.rounds.map((round,index)=><section key={index}>
          <h3 className="font-extrabold text-[#10233f]">{round.name}</h3>
          {round.date?<p className="mt-0.5 text-xs text-slate-500">{round.date}</p>:null}
          <ol className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
            {round.matches.map((match,i)=><li key={i} className="flex items-start gap-3 px-3 py-3"><span className="shrink-0 text-xs font-bold leading-5 text-slate-400">{match.number}</span><span className="min-w-0 break-words font-semibold leading-5 text-[#10233f]">{match.text}</span></li>)}
          </ol>
        </section>)}
        {draw.schedule.length?<section className="rounded-lg bg-slate-50 p-3"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Later round dates</h3><dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-xs">{draw.schedule.map((round,i)=><div key={i} className="contents"><dt className="font-semibold">{round.name}</dt><dd>{round.date}</dd></div>)}</dl></section>:null}
        {draw.notes.map((note,i)=><p key={i} className="whitespace-pre-wrap text-slate-600">{note}</p>)}
      </div>
    </details>
  </div>;
}
