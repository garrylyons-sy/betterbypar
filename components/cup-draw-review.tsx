"use client";

import { cupDrawPresentation } from "@/lib/cup-draw-presentation.mjs";
import { cupDrawAudiences } from "@/lib/cup-draw-notification-policy.mjs";
import { notificationRoleLabel } from "@/lib/notification-policy.mjs";
import { useState } from "react";
import { printCupDrawRecord } from "@/lib/cup-draw-record";
import { Button } from "@/components/ui/button";

export type CupDrawAttempt = {
  id: string; attempt_number: number; status: "Provisional" | "Superseded" | "Confirmed";
  revealed_count: number; created_at: string; created_by_name: string;
  witness_name: string | null; confirmed_at: string | null; confirmed_by_name: string;
  redraw_reason: string | null; superseded_at: string | null; superseded_by_name: string;
  notification_audience?: string[];
  notification_summary?: {notified:number;inbox:number;push:number;excluded:number;skipped:number} | null;
  snapshot: {
    revealOrder?: number[];
    entries: {team_id:string;team_name:string}[];
    rounds: {round_number:number;name:string;fixture_date:string}[];
    bracket: {roundNumber:number;matchNumber:number;homeTeamId:string|null;awayTeamId:string|null;status:string}[];
  };
};
const dateLabel = (value:string) => new Date(value).toLocaleString("en-IE",{timeZone:"Europe/Dublin",dateStyle:"medium",timeStyle:"short"});

function Pairings({attempt,limit}:{attempt:CupDrawAttempt;limit?:number}) {
  const view = cupDrawPresentation(attempt.snapshot,limit??Infinity);
  if(limit===0)return <p className="text-sm text-[#6c5a73]">No teams revealed yet. Use Reveal to see each round take shape.</p>;
  return <div className="grid gap-3 sm:grid-cols-2" aria-live="polite">{view.rounds.map(round=><section key={round.roundNumber} className="rounded-lg border border-[#ded7e5] bg-white p-3">
    <h4 className="text-sm font-black text-[#25002b]">{round.name}</h4><p className="mb-2 text-xs text-[#6c5a73]">{new Date(`${round.date}T12:00:00`).toLocaleDateString("en-IE")}</p>
    <ol className="grid gap-2">{round.ties.map(tie=><li key={tie.matchNumber} className="rounded-lg bg-[#f7f5fa] p-2 text-sm font-bold text-[#10233f]">
      <p className="mb-1 text-xs font-normal text-[#6c5a73]">{round.roundNumber===1&&view.byes?"Preliminary match":"Match"} {tie.number}</p>
      <p>{tie.home}{tie.homeBye?<span className="ml-1 text-xs font-normal text-[#168f72]">(bye)</span>:null}</p>
      <p className="text-xs font-normal text-[#6c5a73]">v</p>
      <p>{tie.away}{tie.awayBye?<span className="ml-1 text-xs font-normal text-[#168f72]">(bye)</span>:null}</p>
    </li>)}</ol>
  </section>)}</div>;
}

export function CupDrawReview({competitionId,name,status,draws,onSaved,onMessage,notificationConfig}:{competitionId:string;name:string;status:string;draws:CupDrawAttempt[];onSaved:()=>Promise<void>;onMessage:(message:string)=>void;notificationConfig?:{eligibleRoles:string[];enabled:boolean;enabledTypes:string[]}}) {
  const [busy,setBusy]=useState(false);
  const [witness,setWitness]=useState("");
  const [notificationAudience,setNotificationAudience]=useState<string[]>([]);
  const [reason,setReason]=useState("");
  const [redrawing,setRedrawing]=useState(false);
  const [error,setError]=useState("");
  const latest=draws[0];
  const provisional=status==="Draft"&&latest?.status==="Provisional";
  const presentation=latest?cupDrawPresentation(latest.snapshot,latest.revealed_count):null;
  const matchCount=latest?.snapshot.bracket.filter(t=>t.roundNumber===1).length??0;
  async function act(action:string) {
    setBusy(true);setError("");
    try {
      const response=await fetch(`/api/admin/cup-competitions/${competitionId}/draw`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,attemptId:latest?.id,witnessName:witness,reason,notificationAudience:action==="confirm"?notificationAudience:undefined,revealedCount:(latest?.revealed_count??0)+1})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error??"Could not update the draw.");
      await onSaved();setRedrawing(false);setReason("");
      if(action!=="reveal")onMessage(action==="confirm"?`Draw confirmed. Cup fixtures are now published. ${body.notificationSummary?.notified??0} people notified${body.notificationSummary?.excluded?`; ${body.notificationSummary.excluded} excluded by inbox access settings`:""}.`:"Provisional draw saved. Reveal each match with your witness before confirming.");
    } catch(e){setError(e instanceof Error?e.message:"Could not update the draw.");}
    finally{setBusy(false);}
  }
  function printRecord(attempt:CupDrawAttempt) {
    if(!printCupDrawRecord(name,attempt,draws))setError("Allow pop-up windows to print the draw record.");
  }
  return <section className="grid gap-3 rounded-xl bg-[#f7f5fa] p-3" aria-label="Cup draw review">
    {error?<p role="alert" className="text-sm font-bold text-[#b42318]">{error}</p>:null}
    {status==="Draft"&&!latest?<div className="grid gap-2 sm:flex sm:items-center sm:justify-between"><p className="text-sm text-[#6c5a73]">Run a provisional draw with your witness. Fixtures stay unpublished until you confirm it.</p><Button disabled={busy} onClick={()=>void act("draw")}>{busy?"Drawing…":"Run provisional draw"}</Button></div>:null}
    {provisional?<>
      <div><h3 className="font-black text-[#25002b]">Provisional — Draw attempt {latest.attempt_number}</h3><p className="text-xs font-semibold text-[#6c5a73]">{dateLabel(latest.created_at)} · Drawn by {latest.created_by_name||"Administrator"} · Fixtures unpublished</p></div>
      <details className="text-sm"><summary className="cursor-pointer font-bold">Entrants and round dates ({latest.snapshot.entries.length} teams)</summary><p className="mt-2">{latest.snapshot.entries.map(e=>e.team_name).join(" · ")}</p><p className="mt-1 text-xs">{latest.snapshot.rounds.map(r=>`${r.name}: ${new Date(`${r.fixture_date}T12:00:00`).toLocaleDateString("en-IE")}`).join(" · ")}</p><p className="mt-1 text-xs">Random home/away allocation. {latest.snapshot.bracket.filter(t=>t.status==="Bye").length} byes. The panels below show who meets in each round.</p></details>
      {presentation?.byes?<p className="rounded-lg bg-white p-3 text-sm font-bold text-[#10233f]">{latest.snapshot.entries.length} teams: {presentation.preliminaryMatches} preliminary {presentation.preliminaryMatches===1?"match":"matches"} and {presentation.byes} {presentation.byes===1?"bye":"byes"} into {presentation.rounds[1]?.name}. Bye teams appear directly in their next-round pairings.</p>:null}
      <Pairings attempt={latest} limit={latest.revealed_count}/>
      {latest.revealed_count<matchCount?<div className="flex flex-wrap items-center gap-3"><Button disabled={busy} onClick={()=>void act("reveal")}>{busy?"Revealing…":presentation?.nextLabel??"Reveal next match"}</Button><span className="text-xs font-bold text-[#6c5a73]">{latest.revealed_count} of {matchCount} draw positions revealed</span></div>:<div className="grid gap-2 rounded-lg border border-[#ded7e5] p-3">
        <label className="grid gap-1 text-sm font-bold">Witness name<input className="min-w-0 rounded-lg border border-[#ded7e5] bg-white p-2 font-normal" maxLength={120} placeholder="Name of the person overseeing the draw" value={witness} onChange={e=>setWitness(e.target.value)}/></label>
        <p className="text-xs text-[#6c5a73]">This records their name; it is not approval from their account. Confirming locks these pairings and publishes cup fixtures.</p>
        <fieldset disabled={busy} className="grid gap-2 border-t border-[#ded7e5] pt-3"><legend className="text-sm font-bold">Notify about this draw (optional)</legend><p className="text-xs text-[#6c5a73]">Choose any groups, or leave all unchecked to notify nobody. The message includes the pairings and each bye team’s next-round opponent. Each person receives one message.</p>{cupDrawAudiences.map(group=><label key={group.key} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={notificationAudience.includes(group.key)} onChange={e=>setNotificationAudience(current=>e.target.checked?[...current,group.key]:current.filter(key=>key!==group.key))}/>{group.label}</label>)}<p className="text-xs text-[#6c5a73]">Global inbox access and personal preferences apply. Phone push requires opt-in for Cup draws on each person's enabled devices.</p>{notificationConfig?<p className="text-xs font-bold text-[#6c5a73]">Current inbox access: {notificationConfig.eligibleRoles.map(notificationRoleLabel).join(", ")||"nobody"}. Change this in Admin → Notifications to include other roles.{!notificationConfig.enabled||!notificationConfig.enabledTypes.includes("cup_draw")?" Cup draw notifications are currently disabled.":""}</p>:null}</fieldset>
        <Button disabled={busy||!witness.trim()} onClick={()=>void act("confirm")}>{busy?"Confirming…":"Confirm and publish draw"}</Button>
      </div>}
      {!redrawing?<button type="button" disabled={busy} className="justify-self-start text-sm font-bold underline" onClick={()=>setRedrawing(true)}>Redraw…</button>:<div className="grid gap-2 rounded-lg border border-[#ded7e5] p-3"><label className="grid gap-1 text-sm font-bold">Reason for redraw<textarea maxLength={500} className="rounded-lg border border-[#ded7e5] bg-white p-2 font-normal" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain why this attempt needs to be replaced"/></label><p className="text-xs text-[#6c5a73]">This attempt and your reason will stay in the full draw history.</p><div className="flex flex-wrap gap-2"><Button disabled={busy||!reason.trim()} onClick={()=>void act("redraw")}>Save reason and redraw</Button><Button variant="secondary" disabled={busy} onClick={()=>setRedrawing(false)}>Cancel</Button></div></div>}
    </>:null}
    {latest?.status==="Confirmed"?<div><h3 className="font-black text-[#168f72]">Draw confirmed — Attempt {latest.attempt_number}</h3><p className="text-xs text-[#6c5a73]">Witness: {latest.witness_name} · {dateLabel(latest.confirmed_at!)} · {latest.confirmed_by_name||"Administrator"}</p></div>:null}
    {draws.length?<details className="border-t border-[#ded7e5] pt-3"><summary className="cursor-pointer text-sm font-black">Full draw history ({draws.length} {draws.length===1?"attempt":"attempts"})</summary><div className="mt-3 grid gap-2">{draws.map(attempt=><details key={attempt.id} className="rounded-lg border border-[#ded7e5] bg-white p-3"><summary className="cursor-pointer text-sm font-bold">Attempt {attempt.attempt_number} · {attempt.status} · {dateLabel(attempt.created_at)}</summary><div className="mt-3 grid gap-2 text-xs text-[#6c5a73]"><p>Drawn by {attempt.created_by_name||"Administrator"}</p>{attempt.status==="Confirmed"?<p>Notification audience: {attempt.notification_audience?.map(key=>cupDrawAudiences.find(a=>a.key===key)?.label??key).join(", ")||"Nobody"}.{attempt.notification_summary?` ${attempt.notification_summary.notified} people notified (${attempt.notification_summary.inbox} inbox, ${attempt.notification_summary.push} phone push queued); ${attempt.notification_summary.excluded} excluded by inbox access, ${attempt.notification_summary.skipped} opted out or unavailable.`:""}</p>:null}{attempt.redraw_reason?<p>Redraw reason: {attempt.redraw_reason} · {attempt.superseded_by_name||"Administrator"} · {dateLabel(attempt.superseded_at!)}</p>:null}{attempt.witness_name?<p>Witness: {attempt.witness_name} · Confirmed by {attempt.confirmed_by_name||"Administrator"} · {dateLabel(attempt.confirmed_at!)}</p>:null}{attempt.status==="Provisional"?<p>Reveal the matches above to review this provisional draw.</p>:<Pairings attempt={attempt}/>}<p>Entrants: {attempt.snapshot.entries.map(e=>e.team_name).join(" · ")}</p><p>{attempt.snapshot.rounds.map(r=>`${r.name}: ${r.fixture_date}`).join(" · ")}</p>{attempt.status!=="Provisional"?<button type="button" className="justify-self-start font-bold underline" onClick={()=>void printRecord(attempt)}>Print draw record</button>:null}</div></details>)}</div></details>:status!=="Draft"?<p className="text-xs text-[#6c5a73]">This cup was drawn before draw history was introduced.</p>:null}
  </section>;
}
