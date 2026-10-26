'use client';
import { useEffect,useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AdminClubFormDraft } from '@/lib/admin-club-form';
import { GolfField,golfInput,golfRequest } from '@/components/golf-ui';
type Contact={id:string;name:string;email?:string};
export function ClubAppointmentsFields({draft,onChange,editable}:{draft:AdminClubFormDraft;onChange:(draft:AdminClubFormDraft)=>void;editable:boolean}) {
 const [people,setPeople]=useState<Contact[]>([]),[error,setError]=useState(''),[firstName,setFirstName]=useState(''),[lastName,setLastName]=useState(''),[email,setEmail]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let alive=true;golfRequest<{people:Contact[]}>('/api/admin/directory').then(d=>{if(alive)setPeople(d.people);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[]);
 async function createContact(){setBusy(true);setError('');try{const d=await golfRequest<{person:Contact}>('/api/admin/directory','POST',{firstName,lastName,email});setPeople(p=>[...p,d.person]);setFirstName('');setLastName('');setEmail('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="grid gap-3 rounded-xl bg-[#f7f5fa] p-4" aria-label="Club appointments"><h4 className="font-extrabold">Club appointments</h4><p className="text-sm">Appoint at least one club administrator and Golf Professional. Assistant Professionals are optional.</p>
 <div className="grid gap-3 md:grid-cols-3">{([
 ['administratorIds','Club administrators (required)'],['professionalIds','Golf Professionals (required)'],['assistantProfessionalIds','Assistant Professionals']
 ] as const).map(([key,label])=><fieldset key={key} className="grid content-start gap-2 rounded-xl bg-white p-3"><legend className="text-sm font-bold">{label}</legend><div className="max-h-48 overflow-auto">{people.map(p=><label key={p.id} className="flex items-center gap-2 py-1.5 text-sm"><input type="checkbox" disabled={!editable} checked={(draft[key]??[]).includes(p.id)} onChange={e=>onChange({...draft,[key]:e.target.checked?[...(draft[key]??[]),p.id]:(draft[key]??[]).filter(id=>id!==p.id)})}/>{p.name}</label>)}</div>{!people.length&&<p className="text-sm">Add a contact below to get started.</p>}</fieldset>)}</div>
 {editable&&<div className="grid gap-2 border-t pt-3 md:grid-cols-4"><GolfField label="First name"><input className={golfInput} value={firstName} onChange={e=>setFirstName(e.target.value)}/></GolfField><GolfField label="Last name"><input className={golfInput} value={lastName} onChange={e=>setLastName(e.target.value)}/></GolfField><GolfField label="Email (optional)"><input className={golfInput} type="email" value={email} onChange={e=>setEmail(e.target.value)}/></GolfField><Button type="button" disabled={busy||!firstName||!lastName} onClick={createContact}>Add contact</Button><p className="text-xs md:col-span-4">Contacts have no login until invited. Send invitations from People after saving the club.</p></div>}
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}</section>;
}
