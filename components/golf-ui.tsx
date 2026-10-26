'use client';
import type { ReactNode } from 'react';
export async function golfRequest<T>(url:string,method='GET',body?:unknown):Promise<T> {
 const response=await fetch(url,{method,cache:'no-store',headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
 const data=await response.json();if(!response.ok) throw new Error(data.error||'Request failed.');return data;
}
export const golfInput='min-h-11 w-full rounded-xl border border-[#ddd6e4] bg-white px-3 py-2 text-sm font-semibold';
export function GolfField({label,children}:{label:string;children:ReactNode}) {return <label className="grid gap-1 text-sm font-bold text-[#6c5a73]"><span>{label}</span>{children}</label>;}
export function GolfSelect({label,value,onChange,options,disabled=false}:{label:string;value:string;onChange:(value:string)=>void;options:{id:string;name:string}[];disabled?:boolean}) {
 return <GolfField label={label}><select className={golfInput} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">Select {label.toLowerCase()}</option>{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></GolfField>;
}
export function lessonTime(value:string) {return new Date(value).toLocaleString('en-IE',{timeZone:'Europe/Dublin',dateStyle:'medium',timeStyle:'short'});}
