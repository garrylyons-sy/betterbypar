'use client';
import {useEffect,useState} from 'react';
import {UserCircle} from 'lucide-react';
export function ProfileAvatar({src,name,className='h-10 w-10'}:{src?:string|null;name:string;className?:string}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[src]);
 return src&&!failed?<img src={src} alt={`${name}'s profile photo`} className={`${className} shrink-0 rounded-full object-cover`} onError={()=>setFailed(true)}/>:<UserCircle aria-hidden="true" className={`${className} shrink-0`}/>;
}
