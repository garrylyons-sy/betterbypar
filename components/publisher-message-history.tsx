'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
type Row={id:string;title:string;createdAt:string;summary:{inbox:number;push:number}};
type History={items:Row[];page:number;pageSize:number;total:number;totalPages:number};
type Detail=Row & {body:string;recipients:{personId:string;name:string;inbox:boolean|null;push:boolean|null}[];recipientSource:'snapshot'|'legacy';recipientTotal:number;recipientPage:number;recipientTotalPages:number};
const endpoint='/api/publisher/messages';
export function PublisherMessageHistory(){
 const [page,setPage]=useState(1),[revision,setRevision]=useState(0);
 const [data,setData]=useState<History|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [expanded,setExpanded]=useState<string|null>(null),[recipientPage,setRecipientPage]=useState(1);
 const [detail,setDetail]=useState<Detail|null>(null),[detailError,setDetailError]=useState(''),[detailRevision,setDetailRevision]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');setExpanded(null);
  void fetch(`${endpoint}?view=history&page=${page}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal})
   .then(async response=>{const payload=await response.json();if(!response.ok)throw Error(payload.error||'Could not load sent messages.');if(!controller.signal.aborted)setData(payload);})
   .catch(reason=>{if(!controller.signal.aborted)setError(reason.message);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[page,revision]);
 useEffect(()=>{
  if(!expanded)return;
  const controller=new AbortController();setDetail(null);setDetailError('');
  void fetch(`${endpoint}?view=detail&id=${encodeURIComponent(expanded)}&recipientPage=${recipientPage}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal})
   .then(async response=>{const payload=await response.json();if(!response.ok)throw Error(payload.error||'Could not load this message.');if(!controller.signal.aborted)setDetail(payload.announcement);})
   .catch(reason=>{if(!controller.signal.aborted)setDetailError(reason.message);});
  return ()=>controller.abort();
 },[expanded,recipientPage,detailRevision]);
 return <div className="grid gap-3">
  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-600">Your messages · 10 per page. Open a message to see its recipients.</p><Button type="button" size="sm" variant="outline" disabled={loading} onClick={()=>setRevision(value=>value+1)}>Refresh</Button></div>
  {loading?<p role="status" className="text-sm">Loading sent messages…</p>:null}
  {error?<p role="alert" className="text-sm text-red-700">{error} <button type="button" className="underline" onClick={()=>setRevision(value=>value+1)}>Retry</button></p>:null}
  {data?<>
   {!data.items.length?<p className="rounded-lg bg-slate-50 p-4 text-sm">You haven’t sent any messages yet.</p>:null}
   <ul className="grid gap-2">{data.items.map(item=><li key={item.id} className="overflow-hidden rounded-xl border border-slate-200">
    <button type="button" disabled={loading} aria-expanded={expanded===item.id} aria-controls={`publisher-sent-${item.id}`} onClick={()=>{setExpanded(value=>value===item.id?null:item.id);setRecipientPage(1);}} className="flex min-h-14 w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50">
     <span className="min-w-0"><span className="block truncate text-sm font-bold">{item.title}</span><span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('en-IE',{dateStyle:'short',timeStyle:'short'})} · Inbox: {item.summary.inbox} · Push queued: {item.summary.push}</span></span><span className="shrink-0 text-xs font-bold underline">{expanded===item.id?'Close':'View'}</span>
    </button>
    {expanded===item.id?<div id={`publisher-sent-${item.id}`} className="grid gap-3 border-t border-slate-200 p-3">
     {detailError?<p role="alert" className="text-sm text-red-700">{detailError} <button type="button" className="underline" onClick={()=>setDetailRevision(value=>value+1)}>Retry</button></p>:detail?.id===item.id?<>
      <h3 className="break-words text-sm font-extrabold">{detail.title}</h3><p className="whitespace-pre-wrap break-words text-sm">{detail.body}</p>
      <div><h4 className="text-sm font-bold">Recipients ({detail.recipientTotal})</h4><p className="mt-1 text-xs text-slate-500">Channels shown are those selected at send time. Phone receipt is not confirmed.</p></div>
      {detail.recipientSource==='legacy'?<p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Older message: this list uses the recipient records still available. Deleted records and some channel details cannot be reconstructed.</p>:null}
      <ul className="max-h-72 overflow-y-auto rounded-lg border border-slate-100">{detail.recipients.map(recipient=><li key={recipient.personId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-100 p-2 last:border-0"><span className="break-words text-sm font-semibold">{recipient.name}</span><span className="text-xs text-slate-500">{[recipient.inbox?'Inbox':null,recipient.push?'Phone push queued':null].filter(Boolean).join(' · ')||(detail.recipientSource==='legacy'?'Channel details unavailable':'No delivery channel')}</span></li>)}</ul>
      {!detail.recipients.length?<p className="text-xs text-slate-600">No recipient records are available.</p>:null}
      {detail.recipientTotalPages>1?<nav aria-label="Recipient pages" className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>Page {detail.recipientPage} of {detail.recipientTotalPages}</span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={detail.recipientPage<=1} onClick={()=>setRecipientPage(detail.recipientPage-1)}>Previous recipients</Button><Button type="button" size="sm" variant="outline" disabled={detail.recipientPage>=detail.recipientTotalPages} onClick={()=>setRecipientPage(detail.recipientPage+1)}>Next recipients</Button></div></nav>:null}
     </>:<p role="status" className="text-sm">Loading message and recipients…</p>}
    </div>:null}
   </li>)}</ul>
   <nav aria-label="Sent message pages" className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{data.total} message{data.total===1?'':'s'} · Page {data.page} of {data.totalPages}</span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={loading||data.page<=1} onClick={()=>setPage(data.page-1)}>Previous</Button><Button type="button" size="sm" variant="outline" disabled={loading||data.page>=data.totalPages} onClick={()=>setPage(data.page+1)}>Next</Button></div></nav>
  </>:null}
 </div>;
}
