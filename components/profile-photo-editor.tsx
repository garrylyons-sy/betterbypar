'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {ProfileAvatar} from '@/components/profile-avatar';
import {prepareProfilePhoto} from '@/lib/client-profile-photo';

type Selection={blob:Blob;preview:string};
export function ProfilePhotoEditor({initialImage,name,playerId,clubId,onChange}:{initialImage?:string|null;name:string;playerId?:string;clubId?:string;onChange?:(image:string|null)=>void}){
 const [photo,setPhoto]=useState(initialImage??'');
 const [selection,setSelection]=useState<Selection|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{setPhoto(initialImage??'');},[initialImage]);
 useEffect(()=>()=>{if(selection)URL.revokeObjectURL(selection.preview);},[selection]);
 async function select(file:File|undefined){
  if(!file)return;setBusy(true);setMessage('');
  try{const blob=await prepareProfilePhoto(file);setSelection({blob,preview:URL.createObjectURL(blob)});}
  catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
 }
 async function persist(remove=false){
  if(!remove&&!selection)return;
  setBusy(true);setMessage('');
  try{
   const target={...(playerId?{playerId}:{}),...(clubId?{clubId}:{})};
   let response:Response;
   if(remove){response=await fetch('/api/profile/photo',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify(target)});}
   else{
    const form=new FormData();form.set('photo',selection!.blob,'profile-photo.webp');
    if(playerId)form.set('playerId',playerId);if(clubId)form.set('clubId',clubId);
    response=await fetch('/api/profile/photo',{method:'POST',body:form});
   }
   const data=await response.json();if(!response.ok)throw new Error(data.error||'The photo could not be saved.');
   setPhoto(data.profileImage??'');setSelection(null);onChange?.(data.profileImage??null);
   setMessage(remove?'Profile photo removed.':'Profile photo saved.');
  }catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
 }
 return <section className="grid gap-4 rounded-2xl border bg-white p-5" aria-label={`${name}'s profile photo`}>
  <div className="flex items-center gap-4"><ProfileAvatar src={selection?.preview??photo} name={name} className="h-24 w-24"/><div><h2 className="text-lg font-extrabold">Profile photo</h2><p className="text-sm text-[#6c5a73]">Photos are resized and compressed for mobile. Your full-size original is not stored.</p></div></div>
  <label className="grid gap-2 text-sm font-bold">Choose photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{void select(e.target.files?.[0]);e.target.value='';}} className="min-h-11 w-full rounded-xl border bg-white p-3"/></label>
  <p className="text-xs text-[#6c5a73]">JPEG, PNG or WebP, up to 20 MB. Saved at up to 512 pixels and 150 KB.</p>
  {selection&&<p className="text-sm font-semibold">Preview — save to use this photo.</p>}
  <div className="flex flex-wrap gap-3">{selection&&<><Button disabled={busy} onClick={()=>persist()}>Save photo</Button><Button variant="secondary" disabled={busy} onClick={()=>{setSelection(null);setMessage('');}}>Discard selection</Button></>}{photo&&<Button variant="secondary" disabled={busy} onClick={()=>persist(true)}>Remove photo</Button>}</div>
  {busy&&<p role="status" className="text-sm">Processing photo…</p>}{message&&<p role="status" className="text-sm font-semibold">{message}</p>}
 </section>;
}
