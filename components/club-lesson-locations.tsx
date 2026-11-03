'use client';
import {useEffect,useState} from 'react';
import {MapPin} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {golfInput,golfRequest} from '@/components/golf-ui';
export function ClubLessonLocations({clubId,clubScope=false,onSaved}:{clubId:string;clubScope?:boolean;onSaved?:()=>void}){
 const [value,setValue]=useState<string|null>(null),[original,setOriginal]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const url=`/api/admin/lesson-locations?clubId=${encodeURIComponent(clubId)}${clubScope?'&scope=club':''}`;
 useEffect(()=>{let active=true;setValue(null);setMessage('');if(clubId)void fetch(url,{cache:'no-store'}).then(async response=>{if(response.status===403)return;const data=await response.json();if(!response.ok)throw Error(data.error);if(active){const text=data.locations.map((l:{name:string})=>l.name).join('\n');setValue(text);setOriginal(text);}}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[clubId,url]);
 async function save(){setBusy(true);setMessage('');try{await golfRequest(url,'PATCH',{clubId,names:(value??'').split('\n').map(n=>n.trim()).filter(Boolean)});setOriginal(value??'');setMessage('Lesson locations saved.');onSaved?.();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 if(value===null)return message?<p role="alert">{message}</p>:null;
 return <section aria-label="Lesson locations" className="grid gap-3 rounded-lg border border-border bg-card p-5"><h3 className="flex items-center gap-2 font-extrabold"><MapPin className="h-5 w-5"/>Lesson locations</h3><p className="text-sm text-muted-foreground">One location per line. Removed locations stay on existing lessons but cannot be chosen for new bookings.</p><label className="grid gap-1 text-sm font-bold">Bookable locations<textarea className={`${golfInput} min-h-28`} maxLength={1620} disabled={busy} value={value} onChange={e=>setValue(e.target.value)} placeholder="Trackman&#10;Range&#10;Playing"/></label><div><Button disabled={busy||value===original} onClick={()=>void save()}>{busy?'Saving…':'Save locations'}</Button></div>{message&&<p role="status" className="text-sm">{message}</p>}</section>;
}
