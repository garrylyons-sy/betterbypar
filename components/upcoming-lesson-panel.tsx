'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,CalendarDays,Clock3} from 'lucide-react';
import {useClubTheme} from '@/components/club-theme-provider';
import {lessonDate,lessonDay,lessonTime,lessonBookingStatus} from '@/shared/lesson-presentation.mjs';
import type {LessonBooking} from '@/shared/lesson-contracts';
type UpcomingLessons={actorId:string;bookings:LessonBooking[];total:number};
export function UpcomingLessonCards({data,now=Date.now()}:{data:UpcomingLessons;now?:number}){
 const bookings=data.bookings.filter(b=>b.status==='Booked'&&Date.parse(b.ends_at)>now);
 if(!bookings.length)return null;
 return <section aria-label="Upcoming lessons" className="overflow-hidden rounded-lg border border-[var(--club-primary)] bg-[var(--club-primary)] text-[var(--club-on-primary)] shadow-sm">
  <div className="flex items-center justify-between gap-3 border-b border-white/20 px-4 py-3"><h2 className="flex items-center gap-2 font-bold"><CalendarDays className="h-5 w-5" aria-hidden="true"/>Next lesson</h2><Link href={`/lessons?booking=${encodeURIComponent(bookings[0].id)}&clubId=${encodeURIComponent(bookings[0].club_id)}#booking-${encodeURIComponent(bookings[0].id)}`} className="text-sm font-semibold underline underline-offset-4">All lessons{data.total>1?` (${data.total})`:''}</Link></div>
  {bookings.map((booking,index)=>{
   const alternate=bookings.length>2&&index%2===1;
   const day=lessonDay(booking.starts_at),today=lessonDay(new Date(now).toISOString()),tomorrow=new Date(Date.parse(`${today}T12:00:00Z`)+86400000).toISOString().slice(0,10);
   return <Link key={booking.id} style={{backgroundColor:alternate?'var(--club-accent)':'var(--club-primary)',color:alternate?'var(--club-on-accent)':'var(--club-on-primary)'}} href={`/lessons?booking=${encodeURIComponent(booking.id)}&clubId=${encodeURIComponent(booking.club_id)}#booking-${encodeURIComponent(booking.id)}`} className={`flex items-center gap-4 px-4 py-4 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] ${index?'border-t border-white/20':''}`}>
    <span style={{backgroundColor:'color-mix(in srgb, currentColor 12%, transparent)'}} className="grid min-w-16 shrink-0 gap-1 rounded-md p-2 text-center"><span className="text-xs font-bold uppercase">{lessonBookingStatus(booking,now)==='In progress'?'Now':day===today?'Today':day===tomorrow?'Tomorrow':new Date(booking.starts_at).toLocaleDateString('en-IE',{weekday:'short',timeZone:'Europe/Dublin'})}</span><span className="text-xl font-extrabold tabular-nums">{lessonTime(booking.starts_at)}</span></span>
    <span className="min-w-0 flex-1"><strong className="block text-base sm:text-lg">{booking.group_name||booking.title||'Golf lesson'}</strong><span className="mt-1 block text-sm">{booking.professional_name}{booking.player_person_id!==data.actorId?` · ${booking.player_name}`:''}</span><span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs opacity-90"><span>{lessonDate(booking.starts_at)}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" aria-hidden="true"/>{lessonTime(booking.starts_at)}–{lessonTime(booking.ends_at)}</span></span>{booking.location_name&&<span className="mt-1 block text-xs">{booking.location_name}</span>}<span className="mt-2 block text-sm font-bold">View lesson</span></span>
    <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true"/>
   </Link>;
  })}
 </section>;
}
export function UpcomingLessonPanel({clubName}:{clubName:string}){
 const {clubs}=useClubTheme(),clubId=clubs.find(c=>c.name===clubName)?.id;
 const [resource,setResource]=useState<{clubId:string;data?:UpcomingLessons;error?:boolean}|null>(null),[retry,setRetry]=useState(0),[now,setNow]=useState(Date.now());
 useEffect(()=>{
  if(!clubId)return;
  let active=true,inFlight=false;const controller=new AbortController();
  const refresh=async()=>{if(inFlight)return;inFlight=true;try{
   const response=await fetch(`/api/lessons/upcoming?clubId=${encodeURIComponent(clubId)}`,{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('Lessons unavailable');
   const data:UpcomingLessons=await response.json();if(active){setNow(Date.now());setResource({clubId,data});}
  }catch{if(active)setResource({clubId,error:true});}finally{inFlight=false;}};
  const visible=()=>{if(document.visibilityState==='visible')void refresh();};
  void refresh();window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);const timer=setInterval(visible,60000);
  return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 },[clubId,retry]);
 if(!clubId)return null;
 if(resource?.clubId!==clubId)return <p role="status" className="text-sm text-muted-foreground">Checking upcoming lessons…</p>;
 if(resource.error)return <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm"><span>Upcoming lessons unavailable.</span><button className="font-bold underline" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>;
 return resource.data?<UpcomingLessonCards data={resource.data} now={now}/>:null;
}
