'use client';
import {ClubLessonLocations} from '@/components/club-lesson-locations';
import {GroupSlotBooking,type DiaryGroup} from '@/components/group-slot-booking';
import {LessonBookingDialog} from '@/components/lesson-booking-dialog';
import {lessonSlotStatus} from '@/lib/lesson-slot-status.mjs';
import {ClubLessonPrivacy} from '@/components/club-lesson-privacy';
import { AdminLessonGroups } from '@/components/admin-lesson-groups';
import {useClubTheme} from '@/components/club-theme-provider';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Plus, Settings2, Trash2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GolfField, GolfSelect, golfInput, golfRequest } from '@/components/golf-ui';

type Range = { day: number; start: string; end: string };
type BookingMember = { id: string; name: string; on_platform: boolean };
type Professional = { id: string; name: string; club_id: string; role: string };
type Slot = { id: string; club_id: string; professional_person_id: string; professional_name: string; professional_role: string; title: string; location_id?:string|null; location_name?:string|null; starts_at: string; ends_at: string; active: boolean; diary_managed: boolean; group_id?: string | null; group_name?: string | null; group_mode?: 'Open' | 'Roster'; capacity?: number | null; booked_count?: number; booking_id?: string | null; player_name?: string | null; goals?: string | null; feedback?: string | null; drills?: string | null };
type Diary = { locations?:{id:string;name:string;club_id:string}[]; clubs: { id: string; name: string }[]; professionals: Professional[]; actorId: string; canEditDiary?: boolean; canBookForMember?: boolean; groups?:DiaryGroup[]; week: string; defaultRanges: Range[]; weekRanges: Range[]; hasOverride: boolean; slots: Slot[] };
const emptyDiary: Diary = { clubs: [], professionals: [], actorId: '', week: '', defaultRanges: [], weekRanges: [], hasOverride: false, slots: [] };
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const input = `${golfInput} !border-[#d4ded6] !text-[#183d31] focus:outline-none focus:ring-2 focus:ring-[#678c72]`;
const dateKey = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
function shiftDate(value: string, amount: number) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); }
function monday() { const today = dateKey(new Date()); const day = new Date(`${today}T12:00:00Z`).getUTCDay(); return shiftDate(today, -(day === 0 ? 6 : day - 1)); }
function shortDate(value: string, options: Intl.DateTimeFormatOptions = {}) { return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-IE', { month: 'short', day: 'numeric', ...options }); }
const time = (value: string) => new Date(value).toLocaleTimeString('en-IE', { timeZone: 'Europe/Dublin', hour: '2-digit', minute: '2-digit', hour12: false });
const cloneRanges = (ranges: Range[]) => ranges.map(range => ({ ...range }));

function HoursEditor({ ranges, onChange, busy }: { ranges: Range[]; onChange: (ranges: Range[]) => void; busy: boolean }) {
 function update(index: number, change: Partial<Range>) { onChange(ranges.map((range, i) => i === index ? { ...range, ...change } : range)); }
 return <div className="divide-y divide-[#e0e5db]">{days.map((day, dayIndex) => <div key={day} className="grid gap-3 py-3 sm:grid-cols-[110px_1fr]">
  <div className="pt-2 text-sm font-bold text-[#264c3a]">{day}</div>
  <div className="grid gap-2">{ranges.map((range, index) => range.day !== dayIndex ? null : <div key={index} className="flex items-center gap-2">
   <input aria-label={`${day} start time ${index + 1}`} type="time" step={1800} className={`${input} max-w-36`} value={range.start} disabled={busy} onChange={event => update(index, { start: event.target.value })}/>
   <span className="text-sm text-[#748274]">to</span>
   <input aria-label={`${day} end time ${index + 1}`} type="time" step={1800} className={`${input} max-w-36`} value={range.end} disabled={busy} onChange={event => update(index, { end: event.target.value })}/>
   <button type="button" disabled={busy} aria-label={`Remove ${day} hours ${index + 1}`} className="rounded-lg p-2 text-[#7a5648] hover:bg-[#eee7dc] disabled:opacity-40" onClick={() => onChange(ranges.filter((_, i) => i !== index))}><Trash2 size={16}/></button>
  </div>)}
   <button type="button" disabled={busy} className="flex w-fit items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold text-[#426b50] hover:bg-[#e8eddf] disabled:opacity-40" onClick={() => onChange([...ranges, { day: dayIndex, start: '09:00', end: '12:00' }])}><Plus size={14}/>{ranges.some(range => range.day === dayIndex) ? 'Add another range' : 'Add hours'}</button>
  </div>
 </div>)}</div>;
}

function LessonCard({ slot, actorId, canBook, canManage, busy, onCancel, onFeedback, onBook, onBookGroup, onManageGroup }: { slot: Slot; actorId: string; canBook: boolean; canManage: boolean; busy: boolean; onCancel: (slot: Slot, bookingOnly: boolean) => Promise<void>; onFeedback: (bookingId: string, feedback: string, drills: string) => Promise<boolean>; onBook: (slot: Slot) => void; onBookGroup: (slot: Slot) => void; onManageGroup: (id: string) => void }) {
 const [editing, setEditing] = useState(false), [feedback, setFeedback] = useState(slot.feedback || ''), [drills, setDrills] = useState(slot.drills || '');
 const ended = new Date(slot.ends_at).getTime() <= Date.now();
 const upcoming = new Date(slot.starts_at).getTime() > Date.now();
 const booked = Boolean(slot.booking_id);
 const own = actorId === slot.professional_person_id;
 const status = lessonSlotStatus(slot);
 useEffect(() => { setFeedback(slot.feedback || ''); setDrills(slot.drills || ''); }, [slot.feedback, slot.drills]);
 if (slot.group_id) return <article data-state={status.state} className="lesson-diary-slot rounded-xl p-3 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-extrabold tabular-nums text-foreground">{time(slot.starts_at)} – {time(slot.ends_at)}</p><span className="lesson-diary-status rounded-full px-2 py-1 text-[10px] font-bold">{status.label}</span></div><p className="mt-3 text-sm font-extrabold text-foreground">{slot.group_name || slot.title}</p><p className="mt-1 text-xs text-muted-foreground">{slot.group_mode === 'Roster' ? 'Fixed roster' : 'Open group'}</p><p className="mt-1 text-xs font-semibold">{slot.location_name||'Location to be confirmed'}</p><p className="mt-2 text-xs font-bold text-muted-foreground">{Number(slot.booked_count || 0)} booked · {slot.capacity == null ? 'No place limit' : `${Math.max(0,slot.capacity-Number(slot.booked_count||0))} of ${slot.capacity} places left`}</p><button type="button" disabled={busy} className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40" onClick={() => onManageGroup(slot.group_id!)}>Manage in Groups</button></article>;
 return <article data-state={status.state} className="lesson-diary-slot rounded-xl p-3 shadow-sm">
  <div className="flex flex-wrap items-center justify-between gap-1"><p className="text-sm font-extrabold tabular-nums text-[#204633]">{time(slot.starts_at)} <span className="font-normal text-[#7c8a78]">– {time(slot.ends_at)}</span></p><span className="lesson-diary-status rounded-full px-2 py-1 text-[10px] font-bold">{status.label}</span></div>
  <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-[#244732]"><UserRound size={14}/>{booked ? slot.player_name || 'Player' : 'Open lesson'}</p>
  <p className="mt-1 text-xs text-[#6b7967]">{slot.title}</p><p className="mt-1 text-xs font-semibold">{slot.location_name||'Location to be confirmed'}</p>
  {slot.goals && <div className="mt-3 rounded-lg bg-white/65 p-2"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#6c7f64]">Player goals</p><p className="mt-1 whitespace-pre-wrap break-words text-xs text-[#3d5540]">{slot.goals}</p></div>}
  {!editing && (slot.feedback || slot.drills) && <div className="mt-3 space-y-2 border-t border-[#c8d5bf] pt-2">{slot.feedback && <div><p className="text-xs font-bold text-[#345b3d]">Coach feedback</p><p className="mt-1 whitespace-pre-wrap break-words text-xs text-[#52654c]">{slot.feedback}</p></div>}{slot.drills && <div><p className="text-xs font-bold text-[#345b3d]">Practice drills</p><p className="mt-1 whitespace-pre-wrap break-words text-xs text-[#52654c]">{slot.drills}</p></div>}</div>}
  {editing && <form className="mt-3 grid gap-3" onSubmit={async event => { event.preventDefault(); if (slot.booking_id && await onFeedback(slot.booking_id, feedback, drills)) setEditing(false); }}>
   <GolfField label="Coach feedback"><textarea className={`${input} min-h-24 font-normal`} maxLength={4000} value={feedback} onChange={event => setFeedback(event.target.value)} disabled={busy}/></GolfField>
   <GolfField label="Practice drills"><textarea className={`${input} min-h-24 font-normal`} maxLength={4000} placeholder="What to practise before the next lesson…" value={drills} onChange={event => setDrills(event.target.value)} disabled={busy}/></GolfField>
   <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy} className="bg-[#244f38] hover:bg-[#163b28]">Save notes</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => { setEditing(false); setFeedback(slot.feedback || ''); setDrills(slot.drills || ''); }}>Close</Button></div>
  </form>}
  {slot.active && upcoming && !booked && canBook && <div className="mt-3 grid gap-2"><button type="button" disabled={busy} className="min-h-11 w-full rounded-md bg-primary px-2 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40" onClick={() => onBook(slot)}>Book for a member</button><button type="button" disabled={busy} className="min-h-11 w-full rounded-md border border-primary/30 bg-card px-2 py-2 text-xs font-bold text-primary disabled:opacity-40" onClick={()=>onBookGroup(slot)}>Book a group</button></div>}
  {slot.active && booked && ended && own && !editing && <button type="button" disabled={busy} className="mt-3 text-xs font-bold text-[#2d6644] underline underline-offset-4 disabled:opacity-40" onClick={() => setEditing(true)}>{slot.feedback || slot.drills ? 'Edit lesson notes' : 'Add feedback & drills'}</button>}
  {slot.active && upcoming && canManage && (booked || !slot.diary_managed) && <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 border-t border-[#dbe3d2] pt-2">{booked && <button type="button" disabled={busy} className="text-[11px] font-semibold text-[#745442] underline underline-offset-2 disabled:opacity-40" onClick={() => onCancel(slot, true)}>Cancel booking</button>}{!slot.diary_managed && <button type="button" disabled={busy} className="text-[11px] font-semibold text-[#745442] underline underline-offset-2 disabled:opacity-40" onClick={() => onCancel(slot, false)}>Cancel lesson</button>}</div>}
 </article>;
}

function LessonDiary({ clubScope = false, onManageGroups }: { clubScope?: boolean; onManageGroups: (groupId: string) => void }) {
 const {setClubId:setThemeClubId,clubs:themeClubs}=useClubTheme();
 const [data, setData] = useState<Diary>(emptyDiary), [clubId, setClubId] = useState(''), [professionalId, setProfessionalId] = useState('');
 const [week, setWeek] = useState(monday), [view, setView] = useState<'week' | 'day'>('week'), [selectedDay, setSelectedDay] = useState(() => (new Date(`${dateKey(new Date())}T12:00:00Z`).getUTCDay() + 6) % 7);
 const [editor, setEditor] = useState<'week' | 'default' | null>(null), [ranges, setRanges] = useState<Range[]>([]);
 const [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
 const [locationId,setLocationId]=useState('');
 const [bookingSlot, setBookingSlot] = useState<Slot | null>(null), [members, setMembers] = useState<BookingMember[]>([]), [membersLoading, setMembersLoading] = useState(false);
 const [memberSearch, setMemberSearch] = useState(''), [playerId, setPlayerId] = useState(''), [bookingGoals, setBookingGoals] = useState(''), [reminderMinutes, setReminderMinutes] = useState(1440), [bookingError, setBookingError] = useState('');
 const requestId = useRef(0);
 const [mobileDiary,setMobileDiary]=useState(true);
 const [groupSlot,setGroupSlot]=useState<Slot|null>(null);
 useEffect(()=>{const media=window.matchMedia('(max-width: 1023px)');const update=()=>setMobileDiary(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 const effectiveView=mobileDiary?'day':view;
 useEffect(()=>{if(clubId&&data.clubs.some(club=>club.id===clubId))setThemeClubId(clubId);},[clubId,data.clubs,setThemeClubId]);
 const scoped = (path: string) => clubScope ? `${path}${path.includes('?') ? '&' : '?'}scope=club` : path;
 async function load() {
  const request = ++requestId.current;
  const query = new URLSearchParams({ week });
  const requestedClub=clubId||new URLSearchParams(window.location.search).get('clubId')||'';
  if (requestedClub) query.set('clubId', requestedClub);
  if (professionalId) query.set('professionalId', professionalId);
  const next = await golfRequest<Diary>(scoped(`/api/admin/lesson-availability?${query}`));
  if (request !== requestId.current) return;
  setData(next);
  const chosenClub = next.clubs.find(club=>club.id===requestedClub)?.id || next.clubs.find(club => next.professionals.some(pro => pro.id === next.actorId && pro.club_id === club.id))?.id || next.clubs[0]?.id || '';
  const own = next.professionals.find(pro => pro.id === next.actorId && pro.club_id === chosenClub);
  const chosenPro = professionalId || own?.id || next.professionals.find(pro => pro.club_id === chosenClub)?.id || '';
  if (chosenClub !== clubId) setClubId(chosenClub);
  if (chosenPro !== professionalId) setProfessionalId(chosenPro);
 }
 useEffect(() => {
  let active = true;
  setLoading(true); setError(''); setEditor(null); setBookingSlot(null); setGroupSlot(null);
  load().catch(reason => { if (active) setError((reason as Error).message); }).finally(() => { if (active) setLoading(false); });
  return () => { active = false; requestId.current++; };
 // Selection changes intentionally reload the selected diary.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [clubId, professionalId, week, clubScope]);
 useEffect(() => {
  if (!bookingSlot) return;
  let active = true;
  setMembersLoading(true); setMembers([]); setBookingError('');
  const query = new URLSearchParams({ clubId: bookingSlot.club_id });
  golfRequest<{ members: BookingMember[] }>(scoped(`/api/admin/lesson-bookings?${query}`))
   .then(result => { if (active) setMembers(result.members); })
   .catch(reason => { if (active) setBookingError((reason as Error).message); })
   .finally(() => { if (active) setMembersLoading(false); });
  return () => { active = false; };
 // Reload the member directory whenever a different lesson is selected.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [bookingSlot?.id, clubScope]);
 useEffect(() => { if (editor) {setBookingSlot(null);setGroupSlot(null);} }, [editor]);
 function openBooking(slot: Slot) {
  setBookingSlot(slot); setLocationId(slot.location_id??''); setEditor(null); setPlayerId(''); setMemberSearch(''); setBookingGoals(''); setReminderMinutes(1440); setBookingError(''); setMessage('');
 }
 async function bookForMember() {
  if (!bookingSlot || !playerId) return;
  setBusy(true); setBookingError(''); setError(''); setMessage('');
  try {
   const result = await golfRequest<{ booking: { id: string }; notified: number }>(scoped('/api/admin/lesson-bookings'), 'POST', { slotId: bookingSlot.id, playerId, goals: bookingGoals, reminderMinutes, locationId });
   setBookingSlot(null);
   setMessage(result.notified > 0 ? 'Booking saved. The member or their registered guardian has been notified.' : 'Booking saved for the member. No in-app notification was sent; the recipient may be offline or have lesson notifications disabled.');
   await load().catch(reason => setError(`The booking was saved, but the diary could not refresh: ${(reason as Error).message}`));
  } catch (reason) { setBookingError((reason as Error).message); }
  finally { setBusy(false); }
 }
 async function mutate(path: string, method: string, body: unknown, success: string) {
  setBusy(true); setError(''); setMessage('');
  try { await golfRequest(scoped(path), method, body); await load(); setMessage(success); return true; }
  catch (reason) { setError((reason as Error).message); return false; }
  finally { setBusy(false); }
 }
 async function saveHours(mode: 'week' | 'default' | 'reset') {
  if (mode !== 'reset') {
   const invalid = ranges.some(range => !range.start || !range.end || range.start >= range.end || !/^\d{2}:(00|30)$/.test(range.start) || !/^\d{2}:(00|30)$/.test(range.end));
   const overlaps = ranges.some((range, index) => ranges.some((other, otherIndex) => index < otherIndex && range.day === other.day && range.start < other.end && range.end > other.start));
   if (invalid || overlaps) { setError('Choose non-overlapping hours in 30-minute steps, with the end after the start.'); return; }
  }
  if (await mutate('/api/admin/lesson-availability', 'POST', { clubId, professionalId, week: mode === 'default' ? monday() : week, mode, ranges: mode === 'reset' ? [] : ranges }, mode === 'default' ? 'Default week saved. Future weeks without overrides will use these hours.' : mode === 'reset' ? 'This week now follows your default hours.' : 'Hours saved for this week.')) setEditor(null);
 }
 const selectedMember = members.find(member => member.id === playerId);
 const filteredMembers = members.filter(member => member.id === playerId || member.name.toLocaleLowerCase().includes(memberSearch.trim().toLocaleLowerCase()));
 const professionals = Array.from(new Map(data.professionals.filter(pro => pro.club_id === clubId).map(pro => [pro.id, pro])).values());
 const professional = professionals.find(pro => pro.id === professionalId);
 const slots = data.slots.filter(slot => slot.professional_person_id === professionalId && slot.club_id === clubId);
 const activeSlots = slots.filter(slot => slot.active);
 const bookedCount = activeSlots.reduce((total, slot) => total + (slot.group_id ? Number(slot.booked_count || 0) : slot.booking_id ? 1 : 0), 0);
 const availableCount = activeSlots.filter(slot => (slot.group_id ? slot.capacity == null || Number(slot.booked_count || 0) < slot.capacity : !slot.booking_id) && new Date(slot.starts_at).getTime() > Date.now()).length;
 const visibleDays = effectiveView === 'day' ? [selectedDay] : days.map((_, index) => index);
 const ownsDiary=data.canEditDiary??(data.actorId===professionalId);
 const canEditHours = ownsDiary && Boolean(clubId && professionalId) && week >= monday();
 const canBookForMember=data.canBookForMember??(data.actorId===professionalId);
 return <section className="overflow-hidden rounded-2xl border border-[#dce2d4] bg-[#f7f7ef] text-[#23432f] shadow-sm" aria-label="Lesson diary">
  <header className="bg-[#173e2b] px-5 py-6 text-[#f8f6e9] sm:px-7">
   <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#c2d1b4]">The coaching diary</p><h2 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight"><CalendarDays size={25} strokeWidth={1.5}/>Lesson diary</h2><p className="mt-2 text-sm text-[#d1ddc8]">Make time for better golf. Your lessons, players and practice plans.</p></div>{!themeClubs.find(club=>club.id===clubId)?.roles?.some(role=>role==='Golf Professional'||role==='Assistant Professional')&&<a className="rounded-lg border border-white/20 px-3 py-2 text-xs font-bold text-[#e6eddc] hover:bg-white/10" href="/lessons">Member bookings ↗</a>}</div>
   <div className="mt-6 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white/10 px-3 py-1.5"><strong className="mr-1">{bookedCount}</strong> booked this week</span><span className="rounded-full bg-white/10 px-3 py-1.5"><strong className="mr-1">{availableCount}</strong> open slots</span><span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><Clock3 size={12}/>30-minute lessons · Dublin time</span></div>
  </header>
  <div className="grid gap-5 p-4 sm:p-6">
   <div className="flex flex-wrap items-end justify-between gap-4"><div className="grid flex-1 gap-3 sm:max-w-xl sm:grid-cols-2">{data.clubs.length>1?<GolfSelect label="Club" value={clubId} options={data.clubs} disabled={busy || loading} onChange={value => { setClubId(value); setProfessionalId(''); setMessage(''); }}/>:<div className="grid content-start gap-1"><p className="text-xs font-bold text-muted-foreground">Club</p><p className="py-2 text-sm font-bold">{data.clubs[0]?.name||'Loading club…'}</p></div>}{professionals.length>1?<GolfSelect label="Coach" value={professionalId} options={professionals.map(pro => ({ id: pro.id, name: `${pro.name}${pro.role === 'Assistant Professional' ? ' · Assistant' : ''}` }))} disabled={busy || loading} onChange={value => { setProfessionalId(value); setMessage(''); }}/>:<div className="grid content-start gap-1"><p className="text-xs font-bold text-muted-foreground">{professional?.id===data.actorId?'Your diary':'Coach'}</p><p className="py-2 text-sm font-bold">{professional?.name||'Loading coach…'}</p></div>}</div><button type="button" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-[#68785f] hover:bg-[#e9eddf] disabled:opacity-40" disabled={busy || loading || !professionalId || !ownsDiary} onClick={() => { setEditor(editor === 'default' ? null : 'default'); setRanges(cloneRanges(data.defaultRanges)); setError(''); }}><Settings2 size={15}/>Default week</button></div>
   {clubId&&<ClubLessonLocations key={`locations-${clubId}`} clubId={clubId} clubScope={clubScope} onSaved={()=>void load()}/>}
   {clubId&&<ClubLessonPrivacy key={clubId} clubId={clubId} clubScope={clubScope}/>}
   {error && <p role="alert" className="rounded-xl border border-[#dfc5b6] bg-[#fff1e7] px-4 py-3 text-sm text-[#863e25]">{error}</p>}
   {message && <p role="status" className="flex items-center gap-2 rounded-xl bg-[#e6eedc] px-4 py-3 text-sm text-[#355d38]"><Check size={16}/>{message}</p>}
   {groupSlot&&<GroupSlotBooking locations={data.locations??[]} canCreateGroup={groupSlot.professional_person_id===data.actorId} slot={groupSlot} groups={data.groups??[]} clubScope={clubScope} onClose={()=>setGroupSlot(null)} onManageGroups={()=>{setGroupSlot(null);onManageGroups('');}} onSaved={async(group,result)=>{setGroupSlot(null);setMessage(`${group.name} booked into this slot.${group.mode==='Roster'?` ${result.booked} player${result.booked===1?'':'s'} booked.`:' Members can now book available places.'}${result.notified?` ${result.notified} account${result.notified===1?'':'s'} notified.`:''}`);await load().catch(reason=>setError(`The group was booked, but the diary could not refresh: ${(reason as Error).message}`));}}/>}
   {bookingSlot && <LessonBookingDialog title="Book for a member" label="Book a lesson for a member" busy={busy} onClose={()=>setBookingSlot(null)}><form className="rounded-xl border border-[#b7caaa] bg-[#edf2e5] p-4 sm:p-5" onSubmit={event => { event.preventDefault(); void bookForMember(); }} aria-label="Book a lesson for a member">
    <p className="text-sm font-semibold text-foreground">{shortDate(dateKey(new Date(bookingSlot.starts_at)), { weekday: 'long' })} · {time(bookingSlot.starts_at)} – {time(bookingSlot.ends_at)}</p><p className="mt-1 text-xs text-muted-foreground">{bookingSlot.professional_name} · 30-minute lesson</p>
    {bookingError && <p role="alert" className="mt-3 rounded-lg bg-[#fff1e7] p-3 text-sm text-[#863e25]">{bookingError}</p>}
    {membersLoading ? <p role="status" className="py-6 text-sm text-muted-foreground">Loading club members…</p> : <div className="mt-4 grid gap-4">
     {selectedMember?<div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3"><div><p className="text-xs font-bold text-muted-foreground">Player</p><p className="mt-1 font-bold">{selectedMember.name}</p></div><button type="button" disabled={busy} className="min-h-11 rounded-md border border-border px-3 text-sm font-bold" onClick={()=>{setPlayerId('');setMemberSearch('');}}>Change member</button></div>:<div className="grid gap-2"><GolfField label="Find a member"><input autoFocus type="search" className={input} value={memberSearch} onChange={event => setMemberSearch(event.target.value)} placeholder="Search members by name…" disabled={busy}/></GolfField><div className="grid max-h-56 gap-1 overflow-y-auto" aria-label="Club members">{filteredMembers.slice(0,8).map(member=><button key={member.id} type="button" disabled={busy} onClick={()=>setPlayerId(member.id)} className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-left text-sm font-bold hover:bg-primary/10"><span>{member.name}</span><Plus size={15} aria-hidden="true"/></button>)}</div>{filteredMembers.length>8&&<p className="text-xs text-muted-foreground">Search to find more members.</p>}{!filteredMembers.length&&<p className="text-sm text-muted-foreground">{members.length?'No members match your search.':'No active members are available for this club.'}</p>}</div>}
     {(data.locations?.length??0)>0&&<GolfField label="Lesson location"><select className={golfInput} disabled={busy} value={locationId} onChange={e=>setLocationId(e.target.value)}><option value="">To be confirmed</option>{data.locations?.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></GolfField>}
     <details className="rounded-md border border-border bg-card p-3"><summary className="cursor-pointer text-sm font-bold">Goals & reminder (optional)</summary><div className="mt-3 grid gap-3"><GolfField label="Lesson goals"><textarea className={`${input} min-h-20 font-normal`} maxLength={2000} disabled={busy} value={bookingGoals} onChange={event => setBookingGoals(event.target.value)} placeholder="What would they like to work on?"/></GolfField><GolfField label="Reminder"><select className={input} disabled={busy} value={reminderMinutes} onChange={event => setReminderMinutes(Number(event.target.value))}>{[{ value: 0, name: 'No reminder' }, { value: 30, name: '30 minutes before' }, { value: 60, name: '1 hour before' }, { value: 120, name: '2 hours before' }, { value: 1440, name: '24 hours before' }, { value: 2880, name: '48 hours before' }].map(option => <option key={option.value} value={option.value}>{option.name}</option>)}</select></GolfField></div></details>
     <p className="text-xs text-muted-foreground">{selectedMember&&!selectedMember.on_platform?'Saved for this member; an eligible guardian can receive a notification.':'Booking notifications and reminders follow the member’s settings.'}</p>
    </div>}
    <div className="mt-4 flex flex-wrap gap-2"><Button type="submit" disabled={busy || membersLoading || !playerId} className="bg-[#244f38] hover:bg-[#163b28]">{busy ? 'Booking…' : 'Book lesson & notify'}</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => setBookingSlot(null)}>Cancel</Button></div>
   </form></LessonBookingDialog>}
   {editor && <div className="rounded-xl border border-[#cbd7bd] bg-[#f0f3e7] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{editor === 'default' ? 'Your default working week' : `Hours for ${shortDate(week)} – ${shortDate(shiftDate(week, 6))}`}</h3><p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#6d7a61]">{editor === 'default' ? 'Set your usual hours once. Future weeks follow this pattern unless you add a weekly override.' : 'Adjust just this week for time off, extra coaching or a different routine. Your default week stays the same.'} Each range creates 30-minute bookable lessons. Booked times are protected.</p></div><button type="button" disabled={busy} className="rounded-lg px-3 py-2 text-xs font-bold hover:bg-[#e2e9d5]" onClick={() => setEditor(null)}>Close</button></div>
    <HoursEditor ranges={ranges} onChange={setRanges} busy={busy}/><div className="mt-4 flex flex-wrap gap-2"><Button disabled={busy} className="bg-[#244f38] hover:bg-[#163b28]" onClick={() => saveHours(editor)}>{busy ? 'Saving…' : editor === 'default' ? 'Save default week' : 'Save this week'}</Button><Button disabled={busy} variant="secondary" onClick={() => setEditor(null)}>Cancel</Button></div>
   </div>}
   <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e0e4d8] pt-5"><div className="flex items-center gap-3"><div className="flex overflow-hidden rounded-lg border border-[#d6ddcd] bg-white"><button type="button" className="p-2.5 hover:bg-[#edf1e5] disabled:opacity-30" aria-label="Previous week" disabled={busy || loading || week <= shiftDate(monday(), -364)} onClick={() => setWeek(shiftDate(week, -7))}><ChevronLeft size={18}/></button><button type="button" className="border-l border-[#d6ddcd] p-2.5 hover:bg-[#edf1e5] disabled:opacity-30" aria-label="Next week" disabled={busy || loading || week >= shiftDate(monday(), 49)} onClick={() => setWeek(shiftDate(week, 7))}><ChevronRight size={18}/></button></div><div><h3 className="text-base font-extrabold">{shortDate(week)} – {shortDate(shiftDate(week, 6), { year: 'numeric' })}</h3><p className="mt-0.5 text-[11px] font-semibold text-[#76826c]">{data.hasOverride ? 'Custom hours this week' : 'Following default hours'}{professional ? ` · ${professional.name}` : ''}</p></div>{week !== monday() && <button type="button" disabled={busy || loading} className="rounded-lg bg-white px-2 py-2 text-xs font-bold" onClick={() => setWeek(monday())}>This week</button>}</div>
    <div className="flex flex-wrap items-center gap-2">{!mobileDiary&&<div className="hidden rounded-lg bg-[#e5eadb] p-1 lg:flex" aria-label="Diary view">{(['day', 'week'] as const).map(option => <button key={option} type="button" aria-pressed={view === option} className={`rounded-md px-3 py-1.5 text-xs font-bold capitalize ${view === option ? 'bg-white shadow-sm' : 'text-[#738168]'}`} onClick={() => setView(option)}>{option}</button>)}</div>}<Button className="bg-[#244f38] text-xs hover:bg-[#163b28]" disabled={busy || loading || !canEditHours} onClick={() => { setEditor(editor === 'week' ? null : 'week'); setRanges(cloneRanges(data.weekRanges)); setError(''); }}><Plus size={15} className="mr-1.5"/>Edit this week</Button></div>
   </div>
   {data.hasOverride && !loading && canEditHours && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-[#cdd9bf] px-3 py-2"><p className="text-xs text-[#728267]">This week has its own hours.</p><button type="button" disabled={busy} className="text-xs font-bold underline underline-offset-2 disabled:opacity-40" onClick={() => saveHours('reset')}>Restore default hours</button></div>}
   <div aria-label="Diary status legend" className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-xs font-bold text-foreground">{[{state:'available',label:'Bookable'},{state:'busy',label:'Busy / full'},{state:'partial',label:'Group · places left'},{state:'inactive',label:'Past / cancelled'}].map(item=><span key={item.state} className="flex items-center gap-2"><span aria-hidden="true" data-state={item.state} className="lesson-diary-key h-3 w-3 rounded-sm"/>{item.label}</span>)}</div>
   {effectiveView === 'day' && <div className="grid grid-cols-7 gap-1">{days.map((day, index) => <button key={day} type="button" aria-pressed={selectedDay === index} onClick={() => setSelectedDay(index)} className={`rounded-lg px-1 py-3 text-center ${selectedDay === index ? 'bg-[#244f38] text-white' : 'bg-[#eef0e7] text-[#6e7d63]'}`}><span className="block text-[10px] font-bold uppercase">{day.slice(0, 3)}</span><span className="mt-1 block text-sm font-extrabold">{new Date(`${shiftDate(week, index)}T12:00:00Z`).getUTCDate()}</span></button>)}</div>}
   {loading ? <div className="grid min-h-48 place-items-center rounded-xl bg-white/60 text-sm text-[#738168]" role="status">Loading your diary…</div> : !professionalId ? <div className="rounded-xl bg-white p-8 text-center text-sm text-[#738168]">{data.professionals.length ? 'Choose a club and professional to open their diary.' : 'No coaching professionals are available for this club yet.'}</div> : <div className={effectiveView === 'week' ? 'overflow-x-auto pb-2' : ''}><div className={effectiveView === 'week' ? 'grid min-w-[1050px] grid-cols-7 gap-2' : 'grid gap-2'}>{visibleDays.map(index => {
    const key = shiftDate(week, index), today = key === dateKey(new Date());
    const daySlots = slots.filter(slot => dateKey(new Date(slot.starts_at)) === key).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return <div key={key} className={`min-w-0 rounded-xl ${today ? 'bg-[#e7eddd]' : 'bg-[#f0f2e9]'} p-2`}><div className={`mb-3 flex items-center justify-between rounded-lg px-2 py-2 ${today ? 'bg-[#244f38] text-white' : 'text-[#607455]'}`}><div><p className="text-[10px] font-bold uppercase tracking-wider">{days[index]}</p><p className="mt-0.5 text-lg font-extrabold">{new Date(`${key}T12:00:00Z`).getUTCDate()} <span className="text-[10px] font-normal">{shortDate(key, { month: 'short', day: undefined })}</span></p></div>{today && <span className="h-1.5 w-1.5 rounded-full bg-[#dae9bb]"/>}</div><div className={effectiveView === 'day' ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'grid gap-2'}>{daySlots.map(slot => <LessonCard key={slot.id} slot={slot} actorId={data.actorId} canBook={canBookForMember} canManage={ownsDiary} busy={busy} onManageGroup={onManageGroups} onBook={openBooking} onBookGroup={slot=>{setGroupSlot(slot);setBookingSlot(null);setEditor(null);setMessage('');setError('');}} onCancel={async (lesson, bookingOnly) => { await mutate(bookingOnly ? '/api/lessons' : '/api/admin/lessons', 'PATCH', bookingOnly ? { id: lesson.booking_id, asManager: true } : { id: lesson.id }, bookingOnly ? 'Booking cancelled. The lesson is available again.' : 'Lesson cancelled.'); }} onFeedback={(bookingId, feedback, drills) => mutate('/api/admin/lesson-feedback', 'PATCH', { bookingId, feedback, drills }, 'Lesson feedback and practice drills saved.')}/>)}</div>{!daySlots.length && <div className="grid min-h-32 content-center gap-1 px-2 text-center"><p className="text-xs font-semibold text-[#89947c]">No lessons</p><p className="text-[10px] leading-relaxed text-[#9ca58f]">{key < dateKey(new Date()) ? 'A quiet day in the diary.' : 'Add hours to open your diary.'}</p></div>}</div>;
   })}</div></div>}
   {!loading && !activeSlots.length && professionalId && !editor && canEditHours && <p className="rounded-lg border border-dashed border-[#cdd9bf] p-4 text-sm leading-relaxed text-[#6f8064]">Your diary is ready. Set your <button type="button" className="font-bold underline" onClick={() => { setEditor('default'); setRanges(cloneRanges(data.defaultRanges)); }}>default week</button> once, or use <strong>Edit this week</strong> for a one-off schedule.</p>}
   <p className="text-[11px] leading-relaxed text-[#8c957f]">All times are Europe/Dublin. Select a past week to review lessons and add feedback after coaching. Only the appointed coach can write lesson notes.</p>
  </div>
 </section>;
}

export function AdminLessons({ clubScope = false }: { clubScope?: boolean }) {
 const [section, setSection] = useState<'diary' | 'groups'>('diary');
 const [selectedGroupId, setSelectedGroupId] = useState('');
 return <div className="grid gap-4"><div className="flex w-full gap-1 rounded-lg border border-border bg-card p-1 sm:w-fit" role="group" aria-label="Lesson management view">{(['diary', 'groups'] as const).map(value => <button key={value} type="button" aria-pressed={section === value} onClick={() => setSection(value)} className={`min-h-11 flex-1 rounded-md px-5 py-2.5 text-sm font-bold capitalize sm:flex-none ${section === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-card'}`}>{value === 'diary' ? 'Lesson diary' : 'Groups'}</button>)}</div>{section === 'groups' ? <AdminLessonGroups clubScope={clubScope} initialGroupId={selectedGroupId}/> : <LessonDiary clubScope={clubScope} onManageGroups={id => { setSelectedGroupId(id); setSection('groups'); }}/>}</div>;
}
