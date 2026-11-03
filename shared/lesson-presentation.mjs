export const lessonReminders=[{value:0,label:'Off'},{value:30,label:'30 minutes before'},{value:60,label:'1 hour before'},{value:120,label:'2 hours before'},{value:1440,label:'24 hours before'},{value:2880,label:'48 hours before'}];
export const lessonDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const lessonTime=value=>new Date(value).toLocaleTimeString('en-IE',{timeZone:'Europe/Dublin',hour:'2-digit',minute:'2-digit'});
export const lessonDate=value=>new Date(value).toLocaleDateString('en-IE',{timeZone:'Europe/Dublin',weekday:'short',day:'numeric',month:'short'});
export const lessonDuration=(start,end)=>Math.round((Date.parse(end)-Date.parse(start))/60000);
export const lessonCoachKey=slot=>slot.professional_person_id??slot.professional_name;
export const eligibleLessonPlayers=(slot,players)=>players.filter(p=>p.club_id===slot.club_id&&(slot.group_mode!=='Roster'||slot.eligible_player_ids?.includes(p.id)));
export const hasLessonPlace=(slotId,playerId,bookings)=>bookings.some(b=>b.slot_id===slotId&&b.player_person_id===playerId&&b.status==='Booked');
export function lessonAvailability(slot){const remaining=slot.capacity==null?null:Math.max(0,Number(slot.capacity)-Number(slot.booked_count??0));const available=!slot.booked&&(remaining===null||remaining>0);return {available,remaining,label:!available?(slot.group_id?'Full':'Booked'):slot.group_id||slot.group_mode?(remaining===null?'No place limit':`${remaining} ${remaining===1?'place':'places'} left`):'Available'};}
export function lessonBookingLists(bookings,now=Date.now()){const upcoming=bookings.filter(b=>b.status==='Booked'&&(Date.parse(b.ends_at??b.starts_at)>now)).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));const ids=new Set(upcoming.map(b=>b.id));return {upcoming,past:bookings.filter(b=>!ids.has(b.id)).sort((a,b)=>b.starts_at.localeCompare(a.starts_at))};}
/** Keep deep-link consumption outside club-keyed screens. */
export const lessonBookingTarget=(bookingId,consumedId)=>bookingId&&bookingId.toLowerCase()!==consumedId?.toLowerCase()?bookingId:undefined;
export const lessonPlayerChangeNeedsConfirmation=(currentId,nextId,goals,reminder)=>currentId!==nextId&&(goals.trim().length>0||reminder!==1440);
export const lessonBookingWriteResolved=(succeeded,input,bookings)=>succeeded||hasLessonPlace(input.slotId,input.playerId,bookings);

export function lessonBookingStatus(booking,now=Date.now()){
 if(booking.status!=='Booked')return booking.status;
 if(Date.parse(booking.ends_at)<=now)return 'Completed';
 return Date.parse(booking.starts_at)<=now?'In progress':'Scheduled';
}
export function lessonResourceLinks(text=''){
 return [...new Set((text??'').match(/https:\/\/[^\s<>"']+|\/practice\/demos\/[a-z0-9-]+/gi)??[])].map(value=>value.replace(/[.,;)]+$/,''));
}
export function lessonSlotGroups(slots){const groups=new Map();for(const slot of slots){const key=`${slot.club_id}:${lessonCoachKey(slot)}:${slot.group_id??'individual'}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(slot);}return [...groups.values()];}

/** No availability is shown until a coach is explicitly selected. */
export const lessonSlotsForProfessional=(slots,professional)=>professional?slots.filter(slot=>lessonCoachKey(slot)===professional):[];

export function upcomingHomeLessons(bookings,clubId,now=Date.now()){
 return bookings.filter(b=>b.club_id===clubId&&b.status==='Booked'&&b.active!==false&&Date.parse(b.ends_at)>now).sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).slice(0,3);
}
export function lessonRelativeDay(value,now=Date.now()){
 const day=lessonDay(value),today=lessonDay(new Date(now).toISOString()),tomorrow=new Date(Date.parse(`${today}T12:00:00Z`)+86400000).toISOString().slice(0,10);
 return day===today?'Today':day===tomorrow?'Tomorrow':new Date(value).toLocaleDateString('en-IE',{weekday:'short',timeZone:'Europe/Dublin'});
}

// Keep coaching seniority consistent, regardless of name or first available time.
export function compareLessonProfessionals(a,b){
 const rank=role=>role==='Assistant Professional'?1:0;
 return rank(a.role??a.professional_role)-rank(b.role??b.professional_role)||String(a.name??a.professional_name??'').localeCompare(String(b.name??b.professional_name??''),'en');
}
