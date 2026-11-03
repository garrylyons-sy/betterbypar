'use client';
import {useEffect,useState} from 'react';
import {SplashScreen} from '@/components/splash-screen';
/** This marker controls presentation only. Authentication is always checked afresh. */
export function SessionLoading(){
 const [startup,setStartup]=useState(false);
 useEffect(()=>{
  try{
   const key='better-by-par:startup-shown';
   if(sessionStorage.getItem(key)!=='1'){sessionStorage.setItem(key,'1');setStartup(true);}
  }catch{/* Storage restrictions should not cause repeated full-screen splashes. */}
 },[]);
 return startup?<SplashScreen/>:<div role="status" className="mx-auto flex min-h-40 max-w-6xl items-center gap-3 p-5 text-sm font-semibold text-muted-foreground"><span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"/>Loading your club…</div>;
}
