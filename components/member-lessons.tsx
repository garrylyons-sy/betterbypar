'use client';
import {LessonBookingDialog} from '@/components/lesson-booking-dialog';
import {LessonBookingCard} from '@/components/lesson-booking-card';
import {useClubTheme} from '@/components/club-theme-provider';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {GolfSelect,golfInput,golfRequest,lessonTime} from '@/components/golf-ui';
import {NotificationBell,NotificationCenter,useNotificationCenter} from '@/components/notification-center';

import type {LessonSlot as Slot,MemberLessonData as Data} from '@/shared/lesson-contracts';
import {lessonSlotsForProfessional,lessonReminders as reminders,lessonDay as dayKey,lessonTime as time,lessonDuration as duration,lessonCoachKey as coachKey,eligibleLessonPlayers,hasLessonPlace,lessonBookingLists,lessonPlayerChangeNeedsConfirmation} from '@/shared/lesson-presentation.mjs';
const lessonCardKey=(slot:Slot)=>`${coachKey(slot)}:${slot.club_id}:${slot.group_id??'personal'}`;
const places=(slot:Slot)=>slot.capacity==null?'No place limit':`${Math.max(0,Number(slot.capacity)-Number(slot.booked_count??0))} ${Number(slot.capacity)-Number(slot.booked_count??0)===1?'place':'places'} left`;
const playersFor=(slot:Slot,data:Data)=>eligibleLessonPlayers(slot,data.players);
const hasPlace=(slotId:string,playerId:string,data:Data)=>hasLessonPlace(slotId,playerId,data.bookings);
function ReminderSelect({value,onChange,disabled=false}:{value:number;onChange:(value:number)=>void;disabled?:boolean}) {return <label className="grid gap-1 text-sm font-bold text-[var(--club-text)]">Reminder<select className={golfInput} value={value} onChange={e=>onChange(Number(e.target.value))} disabled={disabled}>{reminders.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></label>;}

export function MemberLessons({personalView=false,embedded=false}:{personalView?:boolean;embedded?:boolean}){
 const {setClubId:setThemeClubId}=useClubTheme();
 const notifications=useNotificationCenter(!embedded);
 const openedBookingLink=useRef(false);
 const [highlightedBooking,setHighlightedBooking]=useState(''),[expandedBooking,setExpandedBooking]=useState('');
 const [data,setData]=useState<Data>({canManage:false,slots:[],players:[],bookings:[]});
 const [date,setDate]=useState(''),[professional,setProfessional]=useState(''),[selectedId,setSelectedId]=useState(''),[playerId,setPlayerId]=useState(''),[goals,setGoals]=useState(''),[reminder,setReminder]=useState(1440);
 const [tab,setTab]=useState<'available'|'bookings'>(personalView?'bookings':'available'),[history,setHistory]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 async function load(){const next=await golfRequest<Data>('/api/lessons');setData(next);return next;}
 useEffect(()=>{load().catch(e=>setMessage(e.message)).finally(()=>setLoading(false));},[]);
 useEffect(()=>{
  if(loading||openedBookingLink.current)return;
  openedBookingLink.current=true;
  const params=new URLSearchParams(window.location.search);
  if(!params.has('booking'))return;
  const requested=params.get('booking')??'';
  const valid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requested);
  const booking=valid?data.bookings.find(b=>b.id.toLowerCase()===requested.toLowerCase()):undefined;
  setTab('bookings');
  if(!booking){setMessage('This booking could not be found or is no longer available.');return;}
  setHistory(!lessonBookingLists([booking]).upcoming.length);setExpandedBooking(booking.id);
  setHighlightedBooking(booking.id);
  if(booking.club_id)setThemeClubId(booking.club_id);
 },[loading,data.bookings,setThemeClubId]);
 useEffect(()=>{
  if(!highlightedBooking)return;
  const frame=window.requestAnimationFrame(()=>{
   const card=document.getElementById(`booking-${highlightedBooking}`);
   card?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
   card?.focus({preventScroll:true});
  });
  return ()=>window.cancelAnimationFrame(frame);
 },[highlightedBooking]);

 async function mutate(method:string,body:unknown,success:string){
  setBusy(true);setMessage('');
  try{
   await golfRequest('/api/lessons',method,body);
   const next=await load();
   if(method==='POST'){
    const input=body as {slotId:string;playerId:string};
    setGoals('');setSelectedId('');setTab('bookings');setHistory(false);
    setExpandedBooking(next.bookings.find(b=>b.slot_id===input.slotId&&b.player_person_id===input.playerId&&b.status==='Booked')?.id??'');
   }
   setMessage(success);
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 const available=data.slots.filter(s=>new Date(s.starts_at).getTime()>Date.now()).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
 const professionals=Array.from(new Map(available.map(s=>[coachKey(s),{id:coachKey(s),name:s.professional_name,role:s.professional_role??'Golf Professional',club:s.club_name}])).values());
 const filtered=lessonSlotsForProfessional(available,professional);
 const dates=Array.from(new Set(filtered.map(s=>dayKey(s.starts_at))));
 const activeDate=dates.includes(date)?date:dates[0]??'';
 const slots=filtered.filter(s=>dayKey(s.starts_at)===activeDate);
 const selected=available.find(s=>s.id===selectedId&&!s.booked);
 const eligible=selected?playersFor(selected,data):[];
 const alreadyBooked=Boolean(selected&&hasPlace(selected.id,playerId,data));
 const {upcoming,past}=lessonBookingLists(data.bookings);
 function closeBooking(){if(busy)return;if((goals.trim()||reminder!==1440)&&!window.confirm('Discard your unsaved lesson goals and reminder choice?'))return;setSelectedId('');setGoals('');setReminder(1440);}
 function selectSlot(slot:Slot){setMessage('');setThemeClubId(slot.club_id);setSelectedId(slot.id);const players=playersFor(slot,data);const unbooked=players.filter(p=>!hasPlace(slot.id,p.id,data));setPlayerId(unbooked.find(p=>p.id===data.actorId)?.id??unbooked[0]?.id??players[0]?.id??'');setGoals('');setReminder(1440);}
 return <div className="grid gap-6 rounded-3xl bg-[var(--club-page)] p-4 text-[var(--club-text)] sm:p-7">
  {!embedded&&<div className="flex items-center justify-between gap-4"><nav className="flex flex-wrap gap-4 text-sm font-bold underline underline-offset-4">{data.canManage&&<a href="/lessons/manage">Manage lessons</a>}</nav><div className="shrink-0 rounded-xl bg-[var(--club-primary)]"><NotificationBell center={notifications}/></div></div>}
  {!embedded&&<NotificationCenter center={notifications}/>}
  <header><p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--club-muted-text)]">Your next step on the course</p><h1 className="text-3xl font-extrabold sm:text-4xl">{personalView?'My Golf':'Lessons'}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--club-muted-text)]">{personalView?'Your scheduled lessons, professional feedback and practice drills. Open Previous to review completed lessons.':'Find a time with your Golf Professional or Assistant Professional, then book for yourself or a dependant. All times are Europe/Dublin.'}</p></header>
  {message&&<p role="status" className="rounded-xl border border-[var(--club-border)] bg-[var(--club-surface)] p-4 text-sm font-semibold">{message}</p>}

  <nav className="flex flex-wrap gap-2 border-b border-[var(--club-border)] pb-3" aria-label="Lesson sections">{[{label:'Book',active:tab==='available',select:()=>setTab('available')},{label:`Scheduled (${upcoming.length})`,active:tab==='bookings'&&!history,select:()=>{setTab('bookings');setHistory(false);}},{label:'Previous',active:tab==='bookings'&&history,select:()=>{setTab('bookings');setHistory(true);}}].map(item=><Button key={item.label} disabled={busy} variant={item.active?'default':'ghost'} aria-pressed={item.active} onClick={item.select}>{item.label}</Button>)}<Button variant="ghost" disabled={busy||loading} onClick={()=>{setLoading(true);void load().catch(e=>setMessage(e.message)).finally(()=>setLoading(false));}}>Refresh</Button></nav>
  {loading?<p role="status">Loading lessons…</p>:tab==='available'?<>
   <section className="grid gap-5" aria-label="Available lessons"><div><h2 className="text-xl font-extrabold">1. Choose your professional</h2><p className="mt-1 text-sm text-[var(--club-muted-text)]">Then choose a date and a 30-minute lesson time.</p></div><div className="grid gap-3 sm:grid-cols-2" aria-label="Professionals">{professionals.map(p=><button key={p.id} disabled={busy} aria-pressed={professional===p.id} onClick={()=>{setProfessional(p.id);setDate('');setSelectedId('');const first=available.find(s=>coachKey(s)===p.id);if(first)setThemeClubId(first.club_id);}} className={`flex min-h-24 items-center gap-3 rounded-lg border p-4 text-left ${professional===p.id?'border-[var(--club-primary)] bg-[var(--club-primary)] text-[var(--club-on-primary)]':'border-[var(--club-border)] bg-[var(--club-surface)] text-[var(--club-text)]'}`}><span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-current text-sm font-extrabold">{p.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span className="min-w-0 flex-1"><span className="block font-extrabold">{p.name}</span><span className="mt-1 block text-xs">{p.role} · {p.club}</span></span>{professional===p.id&&<span aria-hidden="true">✓</span>}</button>)}</div>
   {!professional&&<p className="rounded-lg border border-dashed border-[var(--club-border)] p-5 text-sm text-[var(--club-muted-text)]">{professionals.length?'Select a professional to see their availability.':'Your club has no published lesson hours yet.'}</p>}
   {professional&&(dates.length>0?<><h2 className="text-lg font-extrabold">2. Choose a date & time</h2><div className="flex gap-2 overflow-x-auto pb-2" aria-label="Available dates">{dates.map(d=>{const start=filtered.find(s=>dayKey(s.starts_at)===d)!.starts_at;return <button key={d} onClick={()=>{setDate(d);setSelectedId('');const first=filtered.find(s=>dayKey(s.starts_at)===d);if(first)setThemeClubId(first.club_id);}} aria-pressed={activeDate===d} className={`min-w-24 shrink-0 rounded-2xl border px-4 py-3 text-center ${activeDate===d?'border-[var(--club-primary)] bg-[var(--club-primary)] text-white':'border-[var(--club-border)] bg-[var(--club-surface)] hover:border-[#64866d]'}`}><span className="block text-xs font-bold uppercase">{new Date(start).toLocaleDateString('en-IE',{timeZone:'Europe/Dublin',weekday:'short'})}</span><span className="mt-1 block text-lg font-extrabold">{new Date(start).toLocaleDateString('en-IE',{timeZone:'Europe/Dublin',day:'numeric',month:'short'})}</span></button>;})}</div>
   <div className="grid gap-4">{Array.from(new Set(slots.map(lessonCardKey))).map(key=>{
    const group=slots.filter(s=>lessonCardKey(s)===key),coach=group[0];
    return <section key={key} className="rounded-2xl border border-[var(--club-border)] bg-[var(--club-surface)] p-5 text-[var(--club-text)]">
     <p className="text-xs font-bold uppercase tracking-wide text-[var(--club-muted-text)]">{coach.group_id?(coach.group_mode==='Roster'?'Roster group':'Open group'):'Individual lesson'}</p>
     <h3 className="mt-1 font-extrabold">{coach.group_name||coach.professional_name}</h3>
     <p className="mt-1 text-sm text-[var(--club-muted-text)]">{coach.group_id&&<>{coach.professional_name} · </>}{coach.professional_role??'Golf Professional'}</p>
     <p className="mt-1 text-sm text-[var(--club-muted-text)]">{coach.club_name}</p>
     <div className="mt-4 grid grid-cols-3 items-start gap-2 sm:grid-cols-4 lg:grid-cols-6">{group.map(s=><div key={s.id} className="min-w-0"><button disabled={busy||s.booked} onClick={()=>selectSlot(s)} aria-pressed={selectedId===s.id} aria-label={`${time(s.starts_at)}, ${s.group_name||s.title}, ${duration(s.starts_at,s.ends_at)} minutes with ${s.professional_name}${s.group_id?`, ${places(s)}`:''}`} className={`flex h-20 w-full flex-col items-center justify-center rounded-md border px-1 py-2 text-sm font-extrabold disabled:opacity-50 ${selectedId===s.id?'border-[var(--club-primary)] bg-[var(--club-primary)] text-[var(--club-on-primary)]':'border-[var(--club-border)] bg-[var(--club-soft)] text-[var(--club-text)] hover:border-[var(--club-primary)]'}`}>
      <span className="text-base tabular-nums">{time(s.starts_at)}</span><span className="text-[10px] font-normal">{duration(s.starts_at,s.ends_at)} min</span>{<span className="mt-1 block text-xs font-normal">{s.booked?(s.group_id?'Full':'Booked'):'Available'}</span>}
     </button>{s.group_id&&<p className="mt-1 text-center text-xs leading-4 text-[var(--club-muted-text)]">{places(s)}</p>}{Boolean(s.attendee_names?.length)&&<p className="mt-1 max-w-48 break-words text-xs leading-5 text-[var(--club-muted-text)]"><span className="font-bold">{s.group_id?'Attending':'Booked for'}: </span>{s.attendee_names!.join(', ')}</p>}</div>)}</div>
    </section>;
   })}</div>
</>:<div className="rounded-2xl border border-dashed border-[var(--club-border)] p-8 text-center"><h3 className="font-extrabold">No available times</h3><p className="mt-2 text-sm text-[var(--club-muted-text)]">{professional?'Try another professional or check back for new availability.':'Your professional needs to publish lesson hours before bookings can be made.'}</p>{data.canManage&&<a className="mt-4 inline-flex min-h-11 items-center font-bold underline" href="/lessons/manage">Set professional availability</a>}</div>)}</section>
  </>:<section className="grid gap-4" aria-label="Your bookings"><h2 className="text-xl font-extrabold">{history?'Previous lessons':'Scheduled lessons'}</h2>{(history?past:upcoming).map(b=><LessonBookingCard key={b.id} booking={b} expanded={expandedBooking===b.id} onToggle={()=>setExpandedBooking(current=>current===b.id?'':b.id)} busy={busy} reminder={<ReminderSelect value={b.reminder_minutes??1440} disabled={busy} onChange={value=>void mutate('PATCH',{id:b.id,action:'reminder',reminderMinutes:value},'Reminder updated.')}/>} onCancel={()=>{if(window.confirm(`Cancel ${b.group_name||b.title} on ${lessonTime(b.starts_at)}? Your place will be released.`))void mutate('PATCH',{id:b.id},'Booking cancelled.');}}/>)}{!(history?past:upcoming).length&&<div className="rounded-lg border border-[var(--club-border)] bg-[var(--club-surface)] p-6"><p className="font-bold">{history?'No previous lessons yet.':'No scheduled lessons.'}</p><p className="mt-2 text-sm text-[var(--club-muted-text)]">{history?'Open a completed lesson here to review feedback and drills from your professional.':'Book a lesson to see it in your schedule.'}</p>{!history&&<Button className="mt-4" onClick={()=>setTab('available')}>Book a lesson</Button>}</div>}</section>}

   {selected&&<LessonBookingDialog busy={busy} onClose={closeBooking}>{message&&<p role="status" className="mb-4 text-sm font-bold">{message}</p>}<form className="grid gap-4" onSubmit={e=>{e.preventDefault();if(playerId&&!alreadyBooked&&eligible.some(p=>p.id===playerId))void mutate('POST',{slotId:selected.id,playerId,goals,reminderMinutes:reminder},'Lesson booked. You can find the details below.');}}><div><p className="text-xs font-bold uppercase tracking-wide text-[var(--club-muted-text)]">Your selected lesson</p><h3 className="mt-2 text-xl font-extrabold">{selected.group_name||selected.title}</h3>{selected.group_id&&<><p className="mt-2 text-sm font-bold text-[var(--club-primary-text)]">{selected.group_mode==='Roster'?'Roster group · eligible players only':'Open group'} · {places(selected)}</p>{selected.title!==selected.group_name&&<p className="mt-1 text-sm text-[var(--club-muted-text)]">{selected.title}</p>}</>}<p className="mt-2 text-sm">{lessonTime(selected.starts_at)} – {time(selected.ends_at)}</p><p className="mt-1 text-sm">{selected.professional_name} · {duration(selected.starts_at,selected.ends_at)} minutes</p><p className="mt-1 text-sm text-[var(--club-muted-text)]">{selected.club_name}</p></div><GolfSelect label="Player" value={playerId} onChange={next=>{if(lessonPlayerChangeNeedsConfirmation(playerId,next,goals,reminder)&&!window.confirm('Change player and clear the unsaved goals and reminder choice for the current player?'))return;setPlayerId(next);setGoals('');setReminder(1440);}} options={eligible.map(p=>({...p,name:`${p.name}${p.id===data.actorId?' (you)':''}${selected&&hasPlace(selected.id,p.id,data)?' · already booked':''}`}))} disabled={busy}/>{!eligible.length&&<p className="text-sm">{selected.group_mode==='Roster'?'No eligible roster player is available for this session.':'No eligible player is available for this club.'}</p>}{alreadyBooked&&<p role="status" className="rounded-xl border border-[var(--club-border)] bg-[var(--club-surface)] p-3 text-sm text-[var(--club-text)]">This player already has a place in this session. Choose another player or view Your bookings.</p>}<label className="grid gap-1 text-sm font-bold">What would you like to work on? <span className="font-normal text-[var(--club-muted-text)]">Optional · share your goals with your professional</span><textarea className={`${golfInput} min-h-28 resize-y`} maxLength={2000} rows={4} value={goals} onChange={e=>setGoals(e.target.value)} placeholder="For example, more consistent putting or confidence off the tee" disabled={busy}/></label><ReminderSelect value={reminder} onChange={setReminder} disabled={busy}/><p className="text-xs leading-5 text-[var(--club-muted-text)]">Reminder delivery follows your notification settings. Choose mobile notifications, email, both, or no alerts in Notification settings.</p><Button type="submit" disabled={busy||!playerId||alreadyBooked||!eligible.some(p=>p.id===playerId)} className="w-full bg-[var(--club-primary)] hover:bg-[var(--club-primary)]">{busy?'Saving…':selected.group_id?'Confirm group place':'Confirm booking'}</Button></form></LessonBookingDialog>}
 </div>;
}
