'use client';
import {useClubTheme} from '@/components/club-theme-provider';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {GolfSelect,golfInput,golfRequest,lessonTime} from '@/components/golf-ui';
import {NotificationBell,NotificationCenter,useNotificationCenter} from '@/components/notification-center';

type Slot={id:string;club_id:string;club_name:string;title:string;professional_person_id?:string;professional_name:string;professional_role?:string;starts_at:string;ends_at:string;booked:boolean;group_id?:string|null;group_name?:string|null;group_mode?:'Open'|'Roster'|null;capacity?:number|null;booked_count?:number;eligible_player_ids?:string[];attendee_names?:string[]};
type Booking={id:string;club_id:string;slot_id?:string;player_person_id?:string;group_id?:string|null;group_name?:string|null;title:string;starts_at:string;ends_at:string;professional_name:string;player_name:string;status:string;goals?:string|null;reminder_minutes?:number;feedback?:string|null;drills?:string|null;reminder_due?:boolean};
type Data={actorId?:string;canManage:boolean;slots:Slot[];players:{id:string;name:string;club_id:string}[];bookings:Booking[]};
const reminders=[{value:0,label:'Off'},{value:30,label:'30 minutes before'},{value:60,label:'1 hour before'},{value:120,label:'2 hours before'},{value:1440,label:'24 hours before'},{value:2880,label:'48 hours before'}];
const dayKey=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const time=(value:string)=>new Date(value).toLocaleTimeString('en-IE',{timeZone:'Europe/Dublin',hour:'2-digit',minute:'2-digit'});
const duration=(start:string,end:string)=>Math.round((new Date(end).getTime()-new Date(start).getTime())/60000);
const coachKey=(slot:Slot)=>slot.professional_person_id??slot.professional_name;
const lessonCardKey=(slot:Slot)=>`${coachKey(slot)}:${slot.club_id}:${slot.group_id??'personal'}`;
const places=(slot:Slot)=>slot.capacity==null?'No place limit':`${Math.max(0,Number(slot.capacity)-Number(slot.booked_count??0))} ${Number(slot.capacity)-Number(slot.booked_count??0)===1?'place':'places'} left`;
const playersFor=(slot:Slot,data:Data)=>data.players.filter(p=>p.club_id===slot.club_id&&(slot.group_mode!=='Roster'||slot.eligible_player_ids?.includes(p.id)));
const hasPlace=(slotId:string,playerId:string,data:Data)=>data.bookings.some(b=>b.slot_id===slotId&&b.player_person_id===playerId&&b.status==='Booked');
function ReminderSelect({value,onChange,disabled=false}:{value:number;onChange:(value:number)=>void;disabled?:boolean}) {return <label className="grid gap-1 text-sm font-bold text-[#365347]">Reminder<select className={golfInput} value={value} onChange={e=>onChange(Number(e.target.value))} disabled={disabled}>{reminders.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></label>;}

export function MemberLessons({personalView=false,embedded=false}:{personalView?:boolean;embedded?:boolean}){
 const {setClubId:setThemeClubId}=useClubTheme();
 const notifications=useNotificationCenter(!embedded);
 const openedBookingLink=useRef(false);
 const [highlightedBooking,setHighlightedBooking]=useState('');
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
  setHistory(!(booking.status==='Booked'&&new Date(booking.starts_at).getTime()>Date.now()));
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
    const slot=next.slots.find(s=>s.id===(body as {slotId:string}).slotId);
    const remaining=slot&&!slot.booked&&slot.group_id?playersFor(slot,next).filter(p=>!hasPlace(slot.id,p.id,next)):[];
    setGoals('');
    if(slot&&remaining.length){setSelectedId(slot.id);setPlayerId(remaining.find(p=>p.id===next.actorId)?.id??remaining[0].id);setTab('available');success='Place booked. You can book another eligible player for this session below, or view Your bookings.';}
    else{setSelectedId('');setTab('bookings');setHistory(false);}
   }
   setMessage(success);
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 const available=data.slots.filter(s=>new Date(s.starts_at).getTime()>Date.now()).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
 const professionals=Array.from(new Map(available.map(s=>[coachKey(s),{id:coachKey(s),name:s.professional_name}])).values());
 const filtered=available.filter(s=>!professional||coachKey(s)===professional);
 const dates=Array.from(new Set(filtered.map(s=>dayKey(s.starts_at))));
 const activeDate=dates.includes(date)?date:dates[0]??'';
 const slots=filtered.filter(s=>dayKey(s.starts_at)===activeDate);
 const selected=available.find(s=>s.id===selectedId&&!s.booked);
 const eligible=selected?playersFor(selected,data):[];
 const alreadyBooked=Boolean(selected&&hasPlace(selected.id,playerId,data));
 const upcoming=data.bookings.filter(b=>b.status==='Booked'&&new Date(b.starts_at).getTime()>Date.now()).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
 const past=data.bookings.filter(b=>!upcoming.some(u=>u.id===b.id)).sort((a,b)=>b.starts_at.localeCompare(a.starts_at));
 function selectSlot(slot:Slot){setThemeClubId(slot.club_id);setSelectedId(slot.id);const players=playersFor(slot,data);const unbooked=players.filter(p=>!hasPlace(slot.id,p.id,data));setPlayerId(unbooked.find(p=>p.id===data.actorId)?.id??unbooked[0]?.id??players[0]?.id??'');setGoals('');setReminder(1440);}
 return <div className="grid gap-6 rounded-3xl bg-[#faf8f1] p-4 text-[#173e31] sm:p-7">
  {!embedded&&<div className="flex items-center justify-between gap-4"><nav className="flex flex-wrap gap-4 text-sm font-bold underline underline-offset-4"><a href="/">Home</a><a href="/family">My dependants</a>{data.canManage&&<a href="/lessons/manage">Manage lessons</a>}</nav><div className="shrink-0 rounded-xl bg-[#173e31]"><NotificationBell center={notifications}/></div></div>}
  {!embedded&&<NotificationCenter center={notifications}/>}
  <header><p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#61786a]">Your next step on the course</p><h1 className="text-3xl font-extrabold sm:text-4xl">{personalView?'My Golf':'Lessons'}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#52695c]">{personalView?'Your lesson bookings, professional feedback and practice drills. Choose Past & cancelled to review feedback from completed lessons.':'Find a time with your Golf Professional or Assistant Professional, then book for yourself or a dependant. All times are Europe/Dublin.'}</p></header>
  {message&&<p role="status" className="rounded-xl border border-[#c8d7cb] bg-white p-4 text-sm font-semibold">{message}</p>}

  <div className="flex gap-2 border-b border-[#dbe1d5] pb-3" aria-label="Lesson sections">{(['available','bookings'] as const).map(t=><Button key={t} variant={tab===t?'default':'ghost'} aria-pressed={tab===t} className={tab===t?'bg-[#173e31] hover:bg-[#285240]':''} onClick={()=>setTab(t)}>{t==='available'?'Find a lesson':`Your bookings (${upcoming.length})`}</Button>)}</div>
  {loading?<p role="status">Loading lessons…</p>:tab==='available'?<>
   <section className="grid gap-5" aria-label="Available lessons"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-extrabold">Choose a date & time</h2><p className="mt-1 text-sm text-[#61786a]">Choose an available time. Booked lessons and full groups are shown as unavailable.</p></div><label className="grid min-w-56 gap-1 text-sm font-bold">Professional<select className={golfInput} value={professional} onChange={e=>{setProfessional(e.target.value);setSelectedId('');const first=available.find(s=>coachKey(s)===e.target.value);if(first)setThemeClubId(first.club_id);}}><option value="">All professionals</option>{professionals.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
   {dates.length>0?<><div className="flex gap-2 overflow-x-auto pb-2" aria-label="Available dates">{dates.map(d=>{const start=filtered.find(s=>dayKey(s.starts_at)===d)!.starts_at;return <button key={d} onClick={()=>{setDate(d);setSelectedId('');const first=filtered.find(s=>dayKey(s.starts_at)===d);if(first)setThemeClubId(first.club_id);}} aria-pressed={activeDate===d} className={`min-w-24 shrink-0 rounded-2xl border px-4 py-3 text-center ${activeDate===d?'border-[#173e31] bg-[#173e31] text-white':'border-[#dbe1d5] bg-white hover:border-[#64866d]'}`}><span className="block text-xs font-bold uppercase">{new Date(start).toLocaleDateString('en-IE',{timeZone:'Europe/Dublin',weekday:'short'})}</span><span className="mt-1 block text-lg font-extrabold">{new Date(start).toLocaleDateString('en-IE',{timeZone:'Europe/Dublin',day:'numeric',month:'short'})}</span></button>;})}</div>
   <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)]"><div className="grid gap-3 sm:grid-cols-2">{Array.from(new Set(slots.map(lessonCardKey))).map(key=>{
    const group=slots.filter(s=>lessonCardKey(s)===key),coach=group[0];
    return <section key={key} className="rounded-2xl border border-[var(--club-border)] bg-[var(--club-surface)] p-5 text-[var(--club-text)]">
     <p className="text-xs font-bold uppercase tracking-wide text-[var(--club-muted-text)]">{coach.group_id?(coach.group_mode==='Roster'?'Roster group':'Open group'):'Individual lesson'}</p>
     <h3 className="mt-1 font-extrabold">{coach.group_name||coach.professional_name}</h3>
     <p className="mt-1 text-sm text-[var(--club-muted-text)]">{coach.group_id&&<>{coach.professional_name} · </>}{coach.professional_role??'Golf Professional'}</p>
     <p className="mt-1 text-sm text-[var(--club-muted-text)]">{coach.club_name}</p>
     <div className="mt-4 flex flex-wrap gap-2">{group.map(s=><div key={s.id} className="max-w-full"><button disabled={busy||s.booked} onClick={()=>selectSlot(s)} aria-pressed={selectedId===s.id} aria-label={`${time(s.starts_at)}, ${s.group_name||s.title}, ${duration(s.starts_at,s.ends_at)} minutes with ${s.professional_name}${s.group_id?`, ${places(s)}`:''}`} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-extrabold disabled:opacity-50 ${selectedId===s.id?'border-[var(--club-primary)] bg-[var(--club-primary)] text-[var(--club-on-primary)]':'border-[var(--club-border)] bg-[var(--club-soft)] text-[var(--club-text)] hover:border-[var(--club-primary)]'}`}>
      {time(s.starts_at)}<span className="ml-1 text-xs font-normal">· {duration(s.starts_at,s.ends_at)}m</span>{<span className="mt-1 block text-xs font-normal">{s.booked?(s.group_id?'Full':'Booked'):s.group_id?places(s):'Available'}</span>}
     </button>{Boolean(s.attendee_names?.length)&&<p className="mt-1 max-w-48 break-words text-xs leading-5 text-[var(--club-muted-text)]"><span className="font-bold">{s.group_id?'Attending':'Booked for'}: </span>{s.attendee_names!.join(', ')}</p>}</div>)}</div>
    </section>;
   })}</div>
   <aside className="rounded-2xl border border-[#dbe1d5] bg-[#f0f2e8] p-5 sm:p-6">{selected?<form className="grid gap-4" onSubmit={e=>{e.preventDefault();if(playerId&&!alreadyBooked&&eligible.some(p=>p.id===playerId))void mutate('POST',{slotId:selected.id,playerId,goals,reminderMinutes:reminder},'Lesson booked. You can find the details below.');}}><div><p className="text-xs font-bold uppercase tracking-wide text-[#61786a]">Your selected lesson</p><h3 className="mt-2 text-xl font-extrabold">{selected.group_name||selected.title}</h3>{selected.group_id&&<><p className="mt-2 text-sm font-bold text-[var(--club-primary-text)]">{selected.group_mode==='Roster'?'Roster group · eligible players only':'Open group'} · {places(selected)}</p>{selected.title!==selected.group_name&&<p className="mt-1 text-sm text-[var(--club-muted-text)]">{selected.title}</p>}</>}<p className="mt-2 text-sm">{lessonTime(selected.starts_at)} – {time(selected.ends_at)}</p><p className="mt-1 text-sm">{selected.professional_name} · {duration(selected.starts_at,selected.ends_at)} minutes</p><p className="mt-1 text-sm text-[#61786a]">{selected.club_name}</p></div><GolfSelect label="Player" value={playerId} onChange={setPlayerId} options={eligible.map(p=>({...p,name:`${p.name}${p.id===data.actorId?' (you)':''}${selected&&hasPlace(selected.id,p.id,data)?' · already booked':''}`}))} disabled={busy}/>{!eligible.length&&<p className="text-sm">{selected.group_mode==='Roster'?'No eligible roster player is available for this session.':'No eligible player is available for this club.'}</p>}{alreadyBooked&&<p role="status" className="rounded-xl border border-[var(--club-border)] bg-[var(--club-surface)] p-3 text-sm text-[var(--club-text)]">This player already has a place in this session. Choose another player or view Your bookings.</p>}<label className="grid gap-1 text-sm font-bold">What would you like to work on? <span className="font-normal text-[#61786a]">Optional · share your goals with your professional</span><textarea className={`${golfInput} min-h-28 resize-y`} maxLength={2000} rows={4} value={goals} onChange={e=>setGoals(e.target.value)} placeholder="For example, more consistent putting or confidence off the tee" disabled={busy}/></label><ReminderSelect value={reminder} onChange={setReminder} disabled={busy}/><p className="text-xs leading-5 text-[#61786a]">Reminder delivery follows your notification settings. Choose mobile notifications, email, both, or no alerts in Notification settings.</p><Button type="submit" disabled={busy||!playerId||alreadyBooked||!eligible.some(p=>p.id===playerId)} className="w-full bg-[#173e31] hover:bg-[#285240]">{busy?'Saving…':selected.group_id?'Confirm group place':'Confirm booking'}</Button></form>:<div className="py-8 text-center"><h3 className="text-lg font-extrabold">Make time for your game</h3><p className="mt-2 text-sm leading-6 text-[#61786a]">Choose an available time to select a player, share your goals and set a reminder.</p></div>}</aside></div></>:<div className="rounded-2xl border border-dashed border-[#c7d1c2] p-8 text-center"><h3 className="font-extrabold">No available times</h3><p className="mt-2 text-sm text-[#61786a]">{professional?'Try another professional or check back for new availability.':'Your club professionals have no available lessons at the moment. Check back for new times.'}</p></div>}</section>
  </>:<section className="grid gap-4" aria-label="Your bookings"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-extrabold">{history?'Past & cancelled lessons':'Upcoming lessons'}</h2><div className="flex gap-2"><Button size="sm" variant={history?'ghost':'outline'} onClick={()=>setHistory(false)} aria-pressed={!history}>Upcoming</Button><Button size="sm" variant={history?'outline':'ghost'} onClick={()=>setHistory(true)} aria-pressed={history}>Past & cancelled</Button></div></div>{(history?past:upcoming).map(b=><article key={b.id} id={`booking-${b.id}`} tabIndex={-1} aria-label={highlightedBooking===b.id?`Selected booking: ${b.title}`:undefined} className={`grid scroll-mt-6 gap-4 rounded-2xl border bg-white p-5 outline-offset-4 sm:p-6 ${highlightedBooking===b.id?'border-[#173e31] ring-2 ring-[#64866d] ring-offset-2':'border-[#dbe1d5]'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-extrabold">{b.group_name||b.title}</h3>{b.group_id&&<p className="mt-1 text-xs font-bold text-[var(--club-muted-text)]">Group lesson</p>}<p className="mt-1 text-sm font-semibold">{b.player_name} with {b.professional_name}</p><p className="mt-2 text-sm text-[#61786a]">{lessonTime(b.starts_at)} – {time(b.ends_at)} · {duration(b.starts_at,b.ends_at)} minutes</p></div><span className="rounded-full bg-[#f0f2e8] px-3 py-1 text-xs font-bold">{b.status==='Booked'&&new Date(b.ends_at).getTime()<Date.now()?'Completed':b.status}</span></div>{b.goals&&<div><h4 className="text-sm font-bold">Your goals</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#52695c]">{b.goals}</p></div>}{!history&&<div className="flex flex-wrap items-end gap-4 border-t border-[#edf0e8] pt-4"><ReminderSelect value={b.reminder_minutes??1440} disabled={busy} onChange={value=>void mutate('PATCH',{id:b.id,action:'reminder',reminderMinutes:value},'Reminder updated.')}/><Button variant="ghost" disabled={busy} onClick={()=>void mutate('PATCH',{id:b.id},'Booking cancelled.')}>Cancel booking</Button></div>}{new Date(b.ends_at).getTime()<=Date.now()&&b.status==='Booked'&&<div className="grid gap-4 rounded-xl bg-[#f5f6ef] p-4 sm:grid-cols-2"><div><h4 className="font-bold">Professional feedback</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#52695c]">{b.feedback||'Your professional has not added feedback yet.'}</p></div><div><h4 className="font-bold">Drills to practise</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#52695c]">{b.drills||'Any practice drills will appear here after your lesson.'}</p></div></div>}</article>)}{!(history?past:upcoming).length&&<p className="rounded-2xl bg-white p-6 text-sm text-[#61786a]">{history?'No past or cancelled lessons yet.':'You have no upcoming lessons. Choose a time in Find a lesson to get started.'}</p>}</section>}
 </div>;
}
