export const reminderChoices=[0,30,60,120,1440,2880];
export function reminderMinutes(value=1440){const n=Number(value);if(!reminderChoices.includes(n))throw new Error('Choose a valid reminder time.');return n;}
export function lessonText(value,max,label){if(value!==undefined&&typeof value!=='string')throw new Error(`Enter valid ${label}.`);const text=(value??'').trim();if(text.length>max)throw new Error(`${label} must be ${max} characters or fewer.`);return text;}
export function dublinDate(value=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
export function addDays(date,days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function weekStart(value=dublinDate()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw new Error('Choose a valid week.');
 const day=new Date(value+'T12:00:00Z').getUTCDay();return addDays(value,-((day+6)%7));
}
export function normalizeRanges(value){
 if(!Array.isArray(value)||value.length>42)throw new Error('Enter up to 42 weekly availability periods.');
 const result=value.map(r=>{
  if(!r||!Number.isInteger(r.day)||r.day<0||r.day>6)throw new Error('Choose a valid weekday.');
  const minutes=t=>{if(typeof t!=='string'||!/^([01]\d|2[0-3]):(00|30)$/.test(t))throw new Error('Hours must use 30-minute blocks.');return Number(t.slice(0,2))*60+Number(t.slice(3));};
  const start=minutes(r.start),end=r.end==='24:00'?1440:minutes(r.end);
  if(end<=start)throw new Error('End time must be after start time.');
  return {day:r.day,start:r.start,end:r.end};
 }).sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start));
 for(let i=1;i<result.length;i++)if(result[i].day===result[i-1].day&&result[i].start<result[i-1].end)throw new Error('Availability periods must not overlap.');
 return result;
}
