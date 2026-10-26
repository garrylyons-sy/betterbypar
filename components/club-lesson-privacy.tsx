'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';

export function ClubLessonPrivacy({clubId,clubScope=false}:{clubId:string;clubScope?:boolean}){
 const [value,setValue]=useState<boolean|null>(null),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const url=`/api/admin/lesson-settings?clubId=${encodeURIComponent(clubId)}${clubScope?'&scope=club':''}`;
 useEffect(()=>{
  let current=true;setValue(null);setMessage('');
  if(clubId)fetch(url,{cache:'no-store'}).then(async response=>{
   if(response.status===403)return;
   const data=await response.json();if(!response.ok)throw new Error(data.error);
   if(current){setValue(data.settings.show_lesson_attendee_names);setSaved(data.settings.show_lesson_attendee_names);}
  }).catch(error=>{if(current)setMessage(error.message);});
  return()=>{current=false;};
 },[clubId,url]);
 async function save(){
  setBusy(true);setMessage('');
  try{
   const response=await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({clubId,showAttendeeNames:value})});
   const data=await response.json();if(!response.ok)throw new Error(data.error);
   setSaved(data.settings.show_lesson_attendee_names);setMessage('Lesson booking privacy saved.');
  }catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
 }
 if(value===null)return message?<p role="alert">{message}</p>:null;
 return <section aria-label="Lesson booking privacy" className="grid gap-3 rounded-xl border border-border bg-card p-5 text-foreground">
  <h3 className="font-extrabold">Lesson booking privacy</h3>
  <label className="flex items-start gap-3 text-sm font-bold"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--club-primary)]" checked={value} disabled={busy} onChange={event=>{setValue(event.target.checked);setMessage('');}}/>Show attendee names to members browsing lessons</label>
  <p className="text-sm text-muted-foreground">Applies to booked individual lessons and group attendees at this club. When off, members see availability and place counts only. Professionals and assistants can always see attendees in their lesson diary. Members can always see their own bookings.</p>
  <div><Button disabled={busy||value===saved} onClick={save}>{busy?'Saving…':'Save lesson privacy'}</Button></div>
  {message&&<p role="status" className="text-sm">{message}</p>}
 </section>;
}
