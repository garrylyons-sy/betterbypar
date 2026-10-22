'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import type {LiveFixture,LivestreamResponse} from '@/lib/livestream-types';

const empty:LivestreamResponse={streams:[],canPublish:false,canView:false};
function dateLabel(value:string){return new Date(value).toLocaleString('en-IE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}
export function MatchLivestreams({publisher,viewer}:{publisher:boolean;viewer:boolean}){
 const [data,setData]=useState<LivestreamResponse>(empty),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [managing,setManaging]=useState(false),[playing,setPlaying]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const [searchInput,setSearchInput]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(1),[fixtures,setFixtures]=useState<LiveFixture[]>([]),[hasMore,setHasMore]=useState(false),[fixturesLoading,setFixturesLoading]=useState(false),[fixtureError,setFixtureError]=useState('');
 const [fixtureId,setFixtureId]=useState(''),[youtubeUrl,setYoutubeUrl]=useState('');
 const busyRef=useRef(false),listRequest=useRef<AbortController|null>(null),mounted=useRef(true);
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
  if(!managing||!data.canPublish){setFixtures([]);return;}
  const controller=new AbortController();setFixturesLoading(true);setFixtureError('');setFixtures([]);setFixtureId('');
  void (async()=>{
   try{const response=await fetch(`/api/livestreams?view=fixtures&q=${encodeURIComponent(search)}&page=${page}`,{cache:'no-store',signal:controller.signal}),body=await response.json();if(controller.signal.aborted)return;if(!response.ok)throw new Error(body.error||'Unable to load matches.');setFixtures(body.items);setHasMore(body.hasMore);}
   catch(reason){if(!controller.signal.aborted)setFixtureError(reason instanceof Error?reason.message:'Unable to load matches.');}
   finally{if(!controller.signal.aborted)setFixturesLoading(false);}
  })();return ()=>controller.abort();
 },[managing,data.canPublish,search,page,revision]);
 async function mutate(payload:object){
  if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/livestreams',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),body=await response.json();
   if(!mounted.current)return;
   if(!response.ok){if(response.status===401||response.status===403){setData(empty);setPlaying(null);setRevision(value=>value+1);}throw new Error(body.error||'Unable to update the live stream.');}
   setNotice('action' in payload&&payload.action==='end'?'Live listing ended. Stop the broadcast in YouTube too.':'Match is listed live. Make sure your YouTube broadcast is running.');
   setYoutubeUrl('');setFixtureId('');setRevision(value=>value+1);
  }catch(reason){if(mounted.current)setError(reason instanceof Error?reason.message:'Unable to update the live stream.');}
  finally{busyRef.current=false;if(mounted.current)setBusy(false);}
 }
 if(!publisher&&!viewer)return null;
 return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Live matches</CardTitle>{data.canPublish?<Button type="button" variant="dark" aria-label="Manage livestreams" onClick={()=>setManaging(value=>!value)}>{managing?'Close publishing':'Make a match live'}</Button>:null}</div></CardHeader><CardContent className="space-y-4">
  {loading?<p role="status" className="text-sm text-slate-600">Loading live matches…</p>:null}
  {error?<div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}<button type="button" className="ml-2 underline" onClick={()=>setRevision(value=>value+1)}>Retry</button></div>:null}
  {notice?<p role="status" className="rounded-lg bg-teal-50 p-3 text-sm text-teal-900">{notice}</p>:null}
  {managing&&data.canPublish?<section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
   <h3 className="font-extrabold">Make a match live</h3>
   <p className="text-sm text-slate-700">Start or schedule your broadcast in YouTube first, then paste its video link here. This makes it available to people with Viewing permission in Interclub Snooker.</p>
   <p className="text-xs text-slate-600">YouTube controls access to the video itself: someone with its link may watch outside this app. Listings expire after 12 hours.</p>
   <a href="https://support.google.com/youtube/answer/9228390" target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-bold underline">How to start a YouTube livestream</a>
   <form aria-label="Search matches" className="flex gap-2" onSubmit={event=>{event.preventDefault();setPage(1);setSearch(searchInput.trim());}}><input aria-label="Search matches" maxLength={100} value={searchInput} onChange={event=>setSearchInput(event.target.value)} placeholder="Team or competition" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white p-2 text-base"/><Button type="submit" variant="secondary" disabled={busy}>Search</Button></form>
   {fixtureError?<p role="alert" className="text-sm text-red-800">{fixtureError}</p>:null}
   <form aria-label="Make a match live" className="space-y-3" onSubmit={event=>{event.preventDefault();void mutate({action:'make-live',fixtureId,youtubeUrl});}}>
    <label className="block text-sm font-bold">Match<select required disabled={busy||fixturesLoading} value={fixtureId} onChange={event=>setFixtureId(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-base font-normal"><option value="">{fixturesLoading?'Loading matches…':'Select a match'}</option>{fixtures.map(fixture=><option key={fixture.id} value={fixture.id}>{fixture.homeTeam} v {fixture.awayTeam} — {fixture.competition} — {dateLabel(fixture.fixtureDate)}</option>)}</select></label>
    {!fixturesLoading&&!fixtures.length&&!fixtureError?<p className="text-sm text-slate-600">No scheduled matches found in the active season.</p>:null}
    <div className="flex items-center justify-between gap-2 text-sm"><Button type="button" variant="secondary" disabled={page===1||fixturesLoading||busy} onClick={()=>setPage(value=>value-1)}>Previous</Button><span>Page {page}</span><Button type="button" variant="secondary" disabled={!hasMore||fixturesLoading||busy} onClick={()=>setPage(value=>value+1)}>Next</Button></div>
    <label className="block text-sm font-bold">YouTube livestream link<input required type="url" maxLength={2048} disabled={busy} value={youtubeUrl} onChange={event=>setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/live/…" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-base font-normal"/></label>
    <Button type="submit" variant="dark" disabled={busy||fixturesLoading||!fixtureId||!youtubeUrl.trim()}>{busy?'Saving…':'Make live'}</Button>
   </form>
  </section>:null}
  {!loading&&!error&&!data.streams.length?<p className="text-sm text-slate-600">{data.canPublish&&!data.canView?'None of your matches are live. Viewing permission is needed to watch other Publishers’ streams.':'No matches are live at the moment.'}</p>:null}
  {stream?<section aria-label="Live match viewer" className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between gap-3 p-3"><h3 className="font-extrabold">{stream.homeTeam} v {stream.awayTeam}</h3><Button type="button" variant="secondary" aria-label="Close viewer" onClick={()=>setPlaying(null)}>Close</Button></div><iframe key={stream.streamId} title={`${stream.homeTeam} v ${stream.awayTeam} live stream`} src={`https://www.youtube.com/embed/${stream.videoId}?autoplay=0`} className="aspect-video min-h-[200px] w-full border-0" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/><a href={`https://www.youtube.com/watch?v=${stream.videoId}`} target="_blank" rel="noopener noreferrer" className="block p-3 text-sm font-bold underline">Watch on YouTube</a></section>:null}
  <div className="grid gap-3">{data.streams.map(item=><article key={item.streamId} className="rounded-xl border border-teal-200 bg-teal-50 p-3"><span className="text-xs font-black uppercase tracking-wide text-red-700">● Live now</span><h3 className="mt-1 font-extrabold">{item.homeTeam} v {item.awayTeam}</h3><p className="mt-1 text-sm text-slate-600">{item.competition} · {dateLabel(item.fixtureDate)}</p><p className="mt-1 text-xs text-slate-600">Published by {item.publisherName}</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="dark" aria-label={`Watch ${item.homeTeam} v ${item.awayTeam}`} onClick={()=>setPlaying(item.streamId)}>Watch match</Button>{item.canEnd?<Button type="button" variant="secondary" disabled={busy} aria-label={`End ${item.homeTeam} v ${item.awayTeam}`} onClick={()=>void mutate({action:'end',id:item.streamId})}>End live listing</Button>:null}</div></article>)}</div>
 </CardContent></Card>;
}
