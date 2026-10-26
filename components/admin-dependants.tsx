'use client';
import {useClubTheme} from '@/components/club-theme-provider';
import { useEffect,useState } from 'react';
import { Card,CardHeader,CardTitle,CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GolfSelect,golfRequest } from '@/components/golf-ui';
type Relationship={id:string;club_name:string;guardian_name:string;player_name:string;relationship:string;active:boolean};
type Person={id:string;name:string;club_id:string;is_player:boolean};
export function AdminDependants({clubScope=false}:{clubScope?:boolean}){
 const {setClubId:setThemeClubId}=useClubTheme();
 const scoped=(url:string)=>clubScope?`${url}${url.includes("?")?"&":"?"}scope=club`:url;
 const [rows,setRows]=useState<Relationship[]>([]),[clubs,setClubs]=useState<{id:string;name:string}[]>([]),[people,setPeople]=useState<Person[]>([]);
 const [clubId,setClubId]=useState(''),[guardianId,setGuardianId]=useState(''),[playerId,setPlayerId]=useState(''),[relationship,setRelationship]=useState('Parent'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 async function load(){const [d,c,p]=await Promise.all([golfRequest<{dependants:Relationship[]}>(scoped('/api/admin/dependants')),golfRequest<{clubs:{id:string;name:string;active:boolean}[]}>(clubScope?'/api/clubadmin':'/api/admin/clubs'),golfRequest<{people:Person[]}>(scoped('/api/admin/directory?memberships=true'))]);setRows(d.dependants);setClubs(c.clubs.filter(c=>c.active!==false));setPeople(p.people);}
 useEffect(()=>{load().catch(e=>setMessage(e.message)).finally(()=>setLoading(false));},[]);
 async function save(method:string,body:unknown){setBusy(true);setMessage('');try{await golfRequest(scoped('/api/admin/dependants'),method,body);await load();setMessage(method==='POST'?'Relationship saved.':'Relationship revoked.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{if(clubId&&clubs.some(club=>club.id===clubId))setThemeClubId(clubId);},[clubId,clubs,setThemeClubId]);
 const members=people.filter(p=>p.club_id===clubId);
 return <Card><CardHeader><CardTitle>Dependants</CardTitle></CardHeader><CardContent className="grid gap-4"><p className="text-sm">Link a parent, guardian or carer to a player. Both need a club membership; the player does not need a login or email. Add them in People first.</p>
 {message&&<p role="status">{message}</p>}{loading?<p>Loading relationships…</p>:<><div className="grid gap-3 md:grid-cols-4"><GolfSelect label="Club" value={clubId} onChange={id=>{setClubId(id);setGuardianId('');setPlayerId('');}} options={clubs}/><GolfSelect label="Account holder" value={guardianId} onChange={setGuardianId} options={members}/><GolfSelect label="Dependant player" value={playerId} onChange={setPlayerId} options={members.filter(p=>p.id!==guardianId&&p.is_player)}/><GolfSelect label="Relationship" value={relationship} onChange={setRelationship} options={['Parent','Guardian','Carer'].map(id=>({id,name:id}))}/></div><Button disabled={busy||!clubId||!guardianId||!playerId} onClick={()=>save('POST',{clubId,guardianId,playerId,relationship})}>Grant relationship</Button>
 <div className="grid gap-2">{rows.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f7f5fa] p-3"><div><p className="font-bold">{r.guardian_name} → {r.player_name}</p><p className="text-sm">{r.relationship} · {r.club_name} · {r.active?'Active':'Revoked'}</p></div>{r.active&&<Button variant="secondary" disabled={busy} onClick={()=>save('PATCH',{id:r.id})}>Revoke</Button>}</div>)}{!rows.length&&<p>No dependant relationships yet.</p>}</div></>}
 </CardContent></Card>;
}
