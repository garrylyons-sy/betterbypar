export const lessonReminders=[{value:0,label:'Off'},{value:30,label:'30 minutes before'},{value:60,label:'1 hour before'},{value:120,label:'2 hours before'},{value:1440,label:'24 hours before'},{value:2880,label:'48 hours before'}];
export const lessonDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const lessonTime=value=>new Date(value).toLocaleTimeString('en-IE',{timeZone:'Europe/Dublin',hour:'2-digit',minute:'2-digit'});
export const lessonDate=value=>new Date(value).toLocaleDateString('en-IE',{timeZone:'Europe/Dublin',weekday:'short',day:'numeric',month:'short'});
export const lessonDuration=(start,end)=>Math.round((Date.parse(end)-Date.parse(start))/60000);
export const lessonCoachKey=slot=>slot.professional_person_id??slot.professional_name;
export const eligibleLessonPlayers=(slot,players)=>players.filter(p=>p.club_id===slot.club_id&&(slot.group_mode!=='Roster'||slot.eligible_player_ids?.includes(p.id)));
export const hasLessonPlace=(slotId,playerId,bookings)=>bookings.some(b=>b.slot_id===slotId&&b.player_person_id===playerId&&b.status==='Booked');
export function lessonAvailability(slot){const remaining=slot.capacity==null?null:Math.max(0,Number(slot.capacity)-Number(slot.booked_count??0));const available=!slot.booked&&(remaining===null||remaining>0);return {available,remaining,label:!available?(slot.group_id?'Full':'Booked'):slot.group_id||slot.group_mode?(remaining===null?'No place limit':`${remaining} ${remaining===1?'place':'places'} left`):'Available'};}
export function lessonBookingLists(bookings,now=Date.now()){const upcoming=bookings.filter(b=>b.status==='Booked'&&Date.parse(b.starts_at)>now).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));const ids=new Set(upcoming.map(b=>b.id));return {upcoming,past:bookings.filter(b=>!ids.has(b.id)).sort((a,b)=>b.starts_at.localeCompare(a.starts_at))};}
/** Keep deep-link consumption outside club-keyed screens. */
export const lessonBookingTarget=(bookingId,consumedId)=>bookingId&&bookingId.toLowerCase()!==consumedId?.toLowerCase()?bookingId:undefined;
export const lessonPlayerChangeNeedsConfirmation=(currentId,nextId,goals,reminder)=>currentId!==nextId&&(goals.trim().length>0||reminder!==1440);
export const lessonBookingWriteResolved=(succeeded,input,bookings)=>succeeded||hasLessonPlace(input.slotId,input.playerId,bookings);
