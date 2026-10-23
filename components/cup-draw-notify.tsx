"use client";
import {useEffect,useRef,useState} from 'react';
import {Bell,Send} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {cupDrawAudiences} from '@/lib/cup-draw-notification-policy.mjs';
import {notificationRoleLabel} from '@/lib/notification-policy.mjs';
type Summary={matched:number;excluded:number;skipped:number;inbox:number;push:number;notified:number};
type Options={title:string;body:string;people:{id:string;name:string}[];eligibleRoles:string[];history:{id:string;createdAt:string;senderName:string;summary:Summary}[]};
type Preview={title:string;body:string;summary:Summary;previewToken:string};
export function CupDrawNotify({competitionId,attemptId}:{competitionId:string;attemptId:string}){
 const [open,setOpen]=useState(false);
 return <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3"><Button type="button" variant="outline" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><Bell className="h-4 w-4" aria-hidden="true"/>{open?'Close draw notification':'Send draw notification'}</Button>{open?<DrawSendForm key={attemptId} competitionId={competitionId} attemptId={attemptId}/>:null}</div>;
}
function DrawSendForm({competitionId,attemptId}:{competitionId:string;attemptId:string}){
 const endpoint=`/api/admin/cup-competitions/${competitionId}/draw-notifications`;
 const [options,setOptions]=useState<Options|null>(null),[loadRevision,setLoadRevision]=useState(0);
 const [mode,setMode]=useState('groups'),[groups,setGroups]=useState<string[]>([]),[personIds,setPersonIds]=useState<string[]>([]),[search,setSearch]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState<Summary|null>(null);
 const busyRef=useRef(false),requestId=useRef('');
 useEffect(()=>{
  const controller=new AbortController();
  void fetch(`${endpoint}?attemptId=${attemptId}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load notification options.');if(!controller.signal.aborted)setOptions(data);}).catch(reason=>{if(!controller.signal.aborted)setError(reason.message);});
  return ()=>controller.abort();
 },[endpoint,attemptId,loadRevision]);
 function edit(change:()=>void){change();setPreview(null);setSent(null);setError('');requestId.current='';}
 async function act(action:'preview'|'send'){
  if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
  try{
   if(action==='send'&&!requestId.current)requestId.current=crypto.randomUUID();
   const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,attemptId,audience:mode==='groups'?{groups}:{personIds},requestId:requestId.current||undefined,previewToken:preview?.previewToken})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not send draw notification.');
   if(action==='preview'){setPreview(data.preview);requestId.current='';}
   else {setSent(data.summary);setPreview(null);requestId.current='';setLoadRevision(value=>value+1);}
  }catch(reason){setError(reason instanceof Error?reason.message:'Could not send draw notification.');}
  finally{busyRef.current=false;setBusy(false);}
 }
 const selected=mode==='groups'?groups.length:personIds.length;
 return <div className="mt-4 grid min-w-0 gap-3">
  <p className="text-sm text-slate-600">Send this confirmed draw again at any stage. Choose groups or specific people. Announcements preferences and phone-push settings apply.</p>
  {error?<p role="alert" className="text-sm font-bold text-red-700">{error}<button type="button" disabled={busy} className="ml-2 underline" onClick={()=>{setError('');setLoadRevision(value=>value+1);}}>Reload options</button></p>:null}
  {!options?<p role="status" className="text-sm">Loading people and draw…</p>:<>
   <details className="rounded-lg border bg-white p-3"><summary className="cursor-pointer text-sm font-bold">Message: {options.title}</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm">{options.body}</p></details>
   <p className="text-xs text-slate-600">Current notification access: {options.eligibleRoles.map(notificationRoleLabel).join(', ')||'Nobody'}. The preview shows any excluded people.</p>
   <fieldset disabled={busy} className="grid min-w-0 gap-3">
    <label className="grid gap-1 text-sm font-bold">Audience<select className="rounded-lg border bg-white p-2 font-normal" value={mode} onChange={event=>edit(()=>setMode(event.target.value))}><option value="groups">Role groups</option><option value="people">Specific people</option></select></label>
    {mode==='groups'?<div className="grid gap-1">{cupDrawAudiences.map(group=><label key={group.key} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={groups.includes(group.key)} onChange={event=>edit(()=>setGroups(current=>event.target.checked?[...current,group.key]:current.filter(key=>key!==group.key)))}/>{group.label}</label>)}</div>:<div className="grid gap-2"><label className="grid gap-1 text-sm font-bold">Find a person<input type="search" className="min-w-0 rounded-lg border bg-white p-2 font-normal" value={search} onChange={event=>setSearch(event.target.value)}/></label><p className="text-xs">{personIds.length} selected · up to 100 people</p><div className="max-h-60 overflow-y-auto overscroll-contain rounded-lg border bg-white p-2">{options.people.filter(person=>person.name.toLowerCase().includes(search.toLowerCase())).map(person=><label key={person.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={personIds.includes(person.id)} disabled={!personIds.includes(person.id)&&personIds.length>=100} onChange={event=>edit(()=>setPersonIds(current=>event.target.checked?[...current,person.id]:current.filter(id=>id!==person.id)))}/>{person.name}</label>)}</div></div>}
    <Button type="button" variant="outline" disabled={!selected} onClick={()=>void act('preview')}>{busy?'Checking…':'Preview recipients'}</Button>
   </fieldset>
   {preview?<div className="grid gap-3 rounded-lg border bg-white p-3" aria-live="polite"><p className="text-sm font-bold">{preview.summary.notified} recipients · {preview.summary.inbox} inbox · {preview.summary.push} phone push</p><p className="text-xs text-slate-600">{preview.summary.excluded} excluded by access settings · {preview.summary.skipped} opted out or unavailable. Phone push is queued for enabled devices and respects quiet hours.</p><Button type="button" disabled={busy||!preview.summary.notified} onClick={()=>void act('send')}><Send className="h-4 w-4" aria-hidden="true"/>{busy?'Sending…':`Send draw to ${preview.summary.notified} people`}</Button></div>:null}
   {sent?<p role="status" className="rounded-lg bg-teal-100 p-3 text-sm font-bold text-teal-900">Draw sent: {sent.inbox} inbox messages and {sent.push} phone push recipients queued. Preview again to send another notification.</p>:null}
   {options.history.length?<details className="border-t pt-3"><summary className="cursor-pointer text-sm font-bold">Recent manual sends ({options.history.length})</summary><ul className="mt-2 divide-y text-xs">{options.history.map(item=><li key={item.id} className="py-2">{new Date(item.createdAt).toLocaleString('en-IE',{timeZone:'Europe/Dublin',dateStyle:'medium',timeStyle:'short'})} · {item.senderName||'Administrator'} · {item.summary.inbox} inbox / {item.summary.push} phone push</li>)}</ul></details>:null}
  </>}
 </div>;
}
