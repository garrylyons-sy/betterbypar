'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {formatFixtureDateTime} from '@/lib/fixture-scheduling.mjs';
import type {LiveFixture,LivestreamResponse} from '@/lib/livestream-types';

const empty:LivestreamResponse={streams:[],canBroadcast:false,canView:false};
const dateLabel=formatFixtureDateTime;
export function MatchLivestreams({video,viewer,initialStreamId=null}:{video:boolean;viewer:boolean;initialStreamId?:string|null}){
 const [data,setData]=useState<LivestreamResponse>(empty),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [managing,setManaging]=useState(false),[playing,setPlaying]=useState<string|null>(initialStreamId),[busy,setBusy]=useState(false);
 const [searchInput,setSearchInput]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(1),[fixtures,setFixtures]=useState<LiveFixture[]>([]),[hasMore,setHasMore]=useState(false),[fixturesLoading,setFixturesLoading]=useState(false),[fixtureError,setFixtureError]=useState('');
 const [selectedFixture,setSelectedFixture]=useState<LiveFixture|null>(null),[choosingMatch,setChoosingMatch]=useState(true),[fixtureRevision,setFixtureRevision]=useState(0),[youtubeUrl,setYoutubeUrl]=useState('');
 const busyRef=useRef(false),listRequest=useRef<AbortController|null>(null),mounted=useRef(true);
 const [notifyViewers,setNotifyViewers]=useState(false);
 const [revision,setRevision]=useState(0);
 const stream=data.streams.find(item=>item.streamId===playing&&new Date(item.expiresAt).getTime()>Date.now());
 useEffect(()=>{
  mounted.current=true;
  async function refresh(){
   listRequest.current?.abort();const controller=new AbortController();listRequest.current=controller;
   try{
    const response=await fetch('/api/livestreams',{cache:'no-store',signal:controller.signal}),body=await response.json();
    if(controller.signal.aborted||!mounted.current)return;
    if(!response.ok)throw new Error(body.error||'Unable to load live matches.');
    setData(body);setError('');
    if(initialStreamId&&!body.streams.some((item:{streamId:string})=>item.streamId===initialStreamId))setNotice('This stream has ended or is no longer available.');
    setPlaying(current=>body.streams.some((item:{streamId:string})=>item.streamId===current)?current:null);
   }catch(reason){if(controller.signal.aborted||!mounted.current)return;setData(empty);setPlaying(null);setError(reason instanceof Error?reason.message:'Unable to load live matches.');}
   finally{if(!controller.signal.aborted&&mounted.current)setLoading(false);}
  }
  const visibleRefresh=()=>{if(document.visibilityState==='visible')void refresh();};
  void refresh();const timer=setInterval(visibleRefresh,30000);
  window.addEventListener('focus',visibleRefresh);window.addEventListener('interclub:refresh-panels',visibleRefresh);document.addEventListener('visibilitychange',visibleRefresh);
  return ()=>{mounted.current=false;listRequest.current?.abort();clearInterval(timer);window.removeEventListener('focus',visibleRefresh);window.removeEventListener('interclub:refresh-panels',visibleRefresh);document.removeEventListener('visibilitychange',visibleRefresh);};
 },[revision]);
 useEffect(()=>{
  if(!stream)return;
  const timer=setTimeout(()=>{setPlaying(null);setRevision(value=>value+1);},Math.max(0,new Date(stream.expiresAt).getTime()-Date.now()));
  return ()=>clearTimeout(timer);
 },[stream?.streamId,stream?.expiresAt]);
 useEffect(()=>{
  if(!managing||!data.canBroadcast){setFixtures([]);return;}
  const controller=new AbortController();setFixturesLoading(true);setFixtureError('');if(page===1)setFixtures([]);
  void (async()=>{
   try{const response=await fetch(`/api/livestreams?view=fixtures&q=${encodeURIComponent(search)}&page=${page}`,{cache:'no-store',signal:controller.signal}),body=await response.json();if(controller.signal.aborted)return;if(!response.ok)throw new Error(body.error||'Unable to load matches.');setFixtures(previous=>page===1?body.items:[...previous,...body.items.filter((item:LiveFixture)=>!previous.some(existing=>existing.id===item.id))]);setHasMore(body.hasMore);}
   catch(reason){if(!controller.signal.aborted)setFixtureError(reason instanceof Error?reason.message:'Unable to load matches.');}
   finally{if(!controller.signal.aborted)setFixturesLoading(false);}
  })();return ()=>controller.abort();
 },[managing,data.canBroadcast,search,page,revision,fixtureRevision]);
 async function mutate(payload:object){
  if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/livestreams',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),body=await response.json();
   if(!mounted.current)return;
   if(!response.ok){if(response.status===401||response.status===403){setData(empty);setPlaying(null);setRevision(value=>value+1);}throw new Error(body.error||'Unable to update the live stream.');}
   setNotice('action' in payload&&payload.action==='end'?'Live listing ended. Stop the broadcast in YouTube too.':`Match is listed live. Make sure your YouTube broadcast is running.${'notifyViewers' in payload&&payload.notifyViewers?` ${body.notificationsAlreadySent?'Already notified':'Notifications created for'} ${body.notificationCount??0} viewer(s).`:''}`);
   if('action' in payload&&payload.action==='make-live'){setYoutubeUrl('');setNotifyViewers(false);setSelectedFixture(null);setChoosingMatch(true);setPage(1);}
   setRevision(value=>value+1);
  }catch(reason){if(mounted.current)setError(reason instanceof Error?reason.message:'Unable to update the live stream.');}
  finally{busyRef.current=false;if(mounted.current)setBusy(false);}
 }
 if(!video&&!viewer)return null;
 return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Live matches</CardTitle>{data.canBroadcast?<Button type="button" variant="dark" aria-label="Manage livestreams" onClick={()=>{if(!managing)setPage(1);setManaging(value=>!value);}}>{managing?'Close publishing':'Make a match live'}</Button>:null}</div></CardHeader><CardContent className="space-y-4">
  {loading?<p role="status" className="text-sm text-slate-600">Loading live matches…</p>:null}
  {error?<div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}<button type="button" className="ml-2 underline" onClick={()=>setRevision(value=>value+1)}>Retry</button></div>:null}
  {notice?<p role="status" className="rounded-lg bg-teal-50 p-3 text-sm text-teal-900">{notice}</p>:null}
  {managing&&data.canBroadcast?<section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
   <h3 className="font-extrabold">Make a match live</h3>
   <p className="text-sm text-slate-700">Start or schedule your broadcast in YouTube first, then paste its video link here. This makes it available to people with Viewing permission in Interclub Snooker.</p>
   <p className="text-xs text-slate-600">YouTube controls access to the video itself: someone with its link may watch outside this app. Listings expire after 12 hours.</p>
   <a href="https://support.google.com/youtube/answer/9228390" target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-bold underline">How to start a YouTube livestream</a>
   <div className="space-y-3">
    <h4 className="text-sm font-extrabold">1. Choose the match</h4>
    {selectedFixture?<div aria-label="Selected match" className="rounded-xl border-2 border-teal-600 bg-teal-50 p-3"><p className="text-xs font-black uppercase text-teal-800">Selected match</p><p className="mt-1 font-extrabold">{selectedFixture.homeTeam} v {selectedFixture.awayTeam}</p><p className="mt-1 text-sm text-slate-700">{selectedFixture.competition} · {dateLabel(selectedFixture.fixtureDate)}</p>{!choosingMatch?<Button type="button" variant="secondary" size="sm" className="mt-2" aria-label="Change match" disabled={busy} onClick={()=>setChoosingMatch(true)}>Change match</Button>:null}</div>:null}
    {choosingMatch?<>
     <p className="text-sm text-slate-600">Only today’s scheduled matches are shown (Irish time). Search by team or competition, then tap a match to select it.</p>
     <form aria-label="Search matches" className="flex gap-2" onSubmit={event=>{event.preventDefault();setPage(1);setSearch(searchInput.trim());setFixtureRevision(value=>value+1);}}><input aria-label="Search matches" maxLength={100} value={searchInput} onChange={event=>setSearchInput(event.target.value)} placeholder="Team or competition" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white p-2 text-base"/><Button type="submit" variant="secondary" disabled={busy}>Search</Button></form>
     <fieldset disabled={busy} className="space-y-2"><legend className="sr-only">Available matches</legend>{fixtures.map(fixture=><label key={fixture.id} className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-slate-300 bg-white p-3 has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50"><input type="radio" name="livestream-match" value={fixture.id} checked={selectedFixture?.id===fixture.id} onChange={()=>{setSelectedFixture(fixture);setChoosingMatch(false);}} className="h-5 w-5 shrink-0 accent-teal-700"/><span className="min-w-0"><span className="block text-sm font-extrabold">{fixture.homeTeam} v {fixture.awayTeam}</span><span className="mt-1 block text-xs text-slate-600">{fixture.competition} · {dateLabel(fixture.fixtureDate)}</span></span></label>)}</fieldset>
     {fixturesLoading?<p role="status" className="text-sm text-slate-600">Loading matches…</p>:null}
     {!fixturesLoading&&!fixtures.length&&!fixtureError?<p className="text-sm text-slate-600">{search?'No matches today match this search. Try another team or competition name.':'No scheduled matches for today.'}</p>:null}
     {fixtureError?<div role="alert" className="text-sm text-red-800">{fixtureError} <button type="button" aria-label="Retry match search" className="font-bold underline" onClick={()=>setFixtureRevision(value=>value+1)}>Retry</button></div>:null}
     {fixtures.length?<p className="text-xs text-slate-600">Showing {fixtures.length} {fixtures.length===1?'match':'matches'}{hasMore?' — more available':''}.</p>:null}
     {hasMore?<Button type="button" variant="secondary" aria-label="Load more matches" disabled={fixturesLoading||busy||Boolean(fixtureError)} onClick={()=>setPage(value=>value+1)}>{fixturesLoading?'Loading…':'Load more matches'}</Button>:null}
     {selectedFixture?<Button type="button" variant="secondary" aria-label="Keep selected match" disabled={busy} onClick={()=>setChoosingMatch(false)}>Keep selected match</Button>:null}
    </>:null}
   </div>
   <form aria-label="Make a match live" className="space-y-3" onSubmit={event=>{event.preventDefault();if(selectedFixture&&!choosingMatch)void mutate({action:'make-live',fixtureId:selectedFixture.id,youtubeUrl,notifyViewers});}}>
    <h4 className="text-sm font-extrabold">2. Add your YouTube link</h4>
    <label className="block text-sm font-bold">YouTube livestream link<input required type="url" maxLength={2048} disabled={busy} value={youtubeUrl} onChange={event=>setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/live/…" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-base font-normal"/></label>
    <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm"><input type="checkbox" aria-label="Notify everyone with Viewing permission" checked={notifyViewers} disabled={busy} onChange={event=>setNotifyViewers(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700"/><span><span className="block font-bold">Notify everyone with Viewing permission</span><span className="mt-1 block text-xs text-slate-600">Opens this stream when tapped. Uses each viewer’s Announcements preferences, phone push opt-in and quiet hours.</span></span></label>
    <Button type="submit" variant="dark" disabled={busy||!selectedFixture||choosingMatch||!youtubeUrl.trim()}>{busy?'Saving…':'Make live'}</Button>
   </form>
  </section>:null}
  {!loading&&!error&&!data.streams.length?<p className="text-sm text-slate-600">{data.canBroadcast&&!data.canView?'None of your matches are live. Viewing permission is needed to watch other people’s streams.':'No matches are live at the moment.'}</p>:null}
  {stream?<section aria-label="Live match viewer" className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between gap-3 p-3"><h3 className="font-extrabold">{stream.homeTeam} v {stream.awayTeam}</h3><Button type="button" variant="secondary" aria-label="Close viewer" onClick={()=>setPlaying(null)}>Close</Button></div><iframe key={stream.streamId} title={`${stream.homeTeam} v ${stream.awayTeam} live stream`} src={`https://www.youtube.com/embed/${stream.videoId}?autoplay=0`} className="aspect-video min-h-[200px] w-full border-0" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/><a href={`https://www.youtube.com/watch?v=${stream.videoId}`} target="_blank" rel="noopener noreferrer" className="block p-3 text-sm font-bold underline">Watch on YouTube</a></section>:null}
  <div className="grid gap-3">{data.streams.map(item=><article key={item.streamId} className="rounded-xl border border-teal-200 bg-teal-50 p-3"><span className="text-xs font-black uppercase tracking-wide text-red-700">● Live now</span><h3 className="mt-1 font-extrabold">{item.homeTeam} v {item.awayTeam}</h3><p className="mt-1 text-sm text-slate-600">{item.competition} · {dateLabel(item.fixtureDate)}</p><p className="mt-1 text-xs text-slate-600">Made live by {item.broadcasterName}</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="dark" aria-label={`Watch ${item.homeTeam} v ${item.awayTeam}`} onClick={()=>setPlaying(item.streamId)}>Watch match</Button>{item.canEnd?<Button type="button" variant="secondary" disabled={busy} aria-label={`End ${item.homeTeam} v ${item.awayTeam}`} onClick={()=>void mutate({action:'end',id:item.streamId})}>End live listing</Button>:null}</div></article>)}</div>
 </CardContent></Card>;
}
