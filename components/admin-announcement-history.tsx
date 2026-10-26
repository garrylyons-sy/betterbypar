'use client';
import {Fragment, useEffect, useState} from 'react';
import {Button} from '@/components/ui/button';
import {DeliveryCounts, type Counts} from '@/components/admin-notification-composer';
type SentRow={id:string;title:string;createdAt:string;senderName:string;summary:Counts};
type Detail=SentRow & {body:string;clubName?:string|null;teamName?:string|null;audience:{roles:string[];clubId:string|null;teamId:string|null;personIds?:string[];channels?:string[]}};
type HistoryPage={items:SentRow[];page:number;pageSize:number;total:number;totalPages:number};
const endpoint='/api/admin/notifications/announcements';
export function AdminAnnouncementHistory(){
  const [page,setPage]=useState(1);
  const [revision,setRevision]=useState(0);
  const [data,setData]=useState<HistoryPage|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [expanded,setExpanded]=useState<string|null>(null);
  const [details,setDetails]=useState<Record<string,Detail>>({});
  const [detailError,setDetailError]=useState('');
  const [detailRevision,setDetailRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');setExpanded(null);
    void fetch(`${endpoint}?view=history&page=${page}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not load sent announcements.');if(!controller.signal.aborted)setData(result);})
      .catch(reason=>{if(!controller.signal.aborted)setError(reason.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[page,revision]);
  useEffect(()=>{
    if(!expanded || details[expanded])return;
    const controller=new AbortController();
    setDetailError('');
    void fetch(`${endpoint}?view=detail&id=${encodeURIComponent(expanded)}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not load this message.');if(!controller.signal.aborted)setDetails(current=>({...current,[expanded]:result.announcement}));})
      .catch(reason=>{if(!controller.signal.aborted)setDetailError(reason.message);});
    return ()=>controller.abort();
  },[expanded,detailRevision]);
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">10 messages per page. Expand a row to read the message and audience details. Counts show recipients selected at send time.</p><Button size="sm" variant="outline" disabled={loading} onClick={()=>setRevision(value=>value+1)}>Refresh history</Button></div>
    {error && <div role="alert" className="text-sm text-red-700">{error} <button className="underline" onClick={()=>setRevision(value=>value+1)}>Retry</button></div>}
    {loading && <p role="status" className="text-sm">Loading sent announcements…</p>}
    {data && <>
      <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[640px] text-left text-sm" aria-label="Sent announcements" aria-busy={loading}>
        <thead className="bg-muted text-xs text-muted-foreground"><tr><th className="px-3 py-2">Sent</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Sent by</th><th className="px-3 py-2 text-right">Inbox</th><th className="px-3 py-2 text-right">Push</th><th className="px-3 py-2 text-right">Email</th><th className="px-3 py-2"><span className="sr-only">Message details</span></th></tr></thead>
        <tbody>{data.items.map(item=><Fragment key={item.id}>
          <tr className="border-t"><td className="whitespace-nowrap px-3 py-2 text-xs">{new Date(item.createdAt).toLocaleString('en-IE',{dateStyle:'short',timeStyle:'short'})}</td><td className="max-w-64 truncate px-3 py-2 font-semibold" title={item.title}>{item.title}</td><td className="max-w-40 truncate px-3 py-2 text-xs" title={item.senderName}>{item.senderName}</td><td className="px-3 py-2 text-right tabular-nums">{item.summary.inbox}</td><td className="px-3 py-2 text-right tabular-nums">{item.summary.push}</td><td className="px-3 py-2 text-right tabular-nums">{item.summary.email ?? 0}</td><td className="px-3 py-2"><button className="min-h-9 whitespace-nowrap text-xs font-bold underline" disabled={loading} aria-label={`${expanded===item.id?'Collapse':'Read'} ${item.title}`} aria-expanded={expanded===item.id} aria-controls={`sent-message-${item.id}`} onClick={()=>{setDetailError('');setExpanded(current=>current===item.id?null:item.id);}}>{expanded===item.id?'Close':'Read'}</button></td></tr>
          {expanded===item.id && <tr className="border-t bg-muted/40"><td colSpan={7} className="p-4" id={`sent-message-${item.id}`}>
            {details[item.id] ? <div className="space-y-3"><h4 className="break-words font-bold">{item.title}</h4><p className="whitespace-pre-wrap break-words">{details[item.id].body}</p><p className="text-xs text-muted-foreground">Roles: {details[item.id].audience.roles.join(', ')||'All roles'} · Club: {details[item.id].audience.clubId?(details[item.id].clubName||'Former club'):'All clubs'} · Team: {details[item.id].audience.teamId?(details[item.id].teamName||'Former team'):'All teams'}</p>{details[item.id].audience.personIds?<p className="text-xs text-muted-foreground">Specific people selected: {details[item.id].audience.personIds!.length}</p>:null}{details[item.id].audience.channels?<p className="text-xs text-muted-foreground">Delivery: {details[item.id].audience.channels!.map(channel=>channel==='inbox'?'Inbox message':channel==='email'?'Email':'Phone push').join(', ')}</p>:null}<DeliveryCounts counts={item.summary}/></div> : detailError ? <p role="alert" className="text-red-700">{detailError} <button className="underline" onClick={()=>setDetailRevision(value=>value+1)}>Retry</button></p> : <p role="status">Loading message…</p>}
          </td></tr>}
        </Fragment>)}</tbody>
      </table>{data.total===0 && <p className="p-4 text-sm text-muted-foreground">No announcements sent yet.</p>}</div>
      <nav aria-label="Sent announcement pages" className="flex flex-wrap items-center justify-between gap-2 text-xs"><p>{data.total===0?'0 messages':`${(data.page-1)*data.pageSize+1}–${Math.min(data.page*data.pageSize,data.total)} of ${data.total}`} · Page {data.page} of {data.totalPages}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={loading||data.page<=1} onClick={()=>setPage(data.page-1)}>Previous</Button><Button size="sm" variant="outline" disabled={loading||data.page>=data.totalPages} onClick={()=>setPage(data.page+1)}>Next</Button></div></nav>
    </>}
  </div>;
}
