'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {buildClubTheme} from '@/lib/club-theme.mjs';
type Club={id:string;name:string;primaryColor:string|null;accentColor:string|null};
type ThemeContext={clubs:Club[];clubId:string;setClubId:(id:string)=>void;refresh:()=>Promise<void>;preview:(primary:string,accent:string)=>void;clearPreview:()=>void};
const Theme=createContext<ThemeContext>({clubs:[],clubId:'',setClubId:()=>{},refresh:async()=>{},preview:()=>{},clearPreview:()=>{}});
export const useClubTheme=()=>useContext(Theme);
const storageKey='better-by-par:active-club';
export function ClubThemeProvider({children}:{children:React.ReactNode}){
 const pathname=usePathname();
 const [clubs,setClubs]=useState<Club[]>([]),[clubId,setSelected]=useState(''),[draft,setDraft]=useState<{primary:string;accent:string}|null>(null);
 const requestRevision=useRef(0);
 const refresh=useCallback(async()=>{
  const revision=++requestRevision.current;
  try{
   const response=await fetch('/api/club-theme',{cache:'no-store',credentials:'same-origin'});
   if(!response.ok&&response.status!==401)return;
   const data=await response.json();if(revision!==requestRevision.current)return;
   const rows:Club[]=response.status===401?[]:data.clubs??[];setClubs(rows);
   let saved='';try{saved=sessionStorage.getItem(storageKey)??'';}catch{}
   setSelected(current=>rows.some(c=>c.id===current)?current:rows.some(c=>c.id===saved)?saved:rows[0]?.id??'');
  }catch{/* Keep the last confirmed theme during transient connection failures. */}
 },[]);
 const setClubId=useCallback((id:string)=>{if(id)setSelected(id);},[]);
 const preview=useCallback((primary:string,accent:string)=>setDraft(current=>current?.primary===primary&&current?.accent===accent?current:{primary,accent}),[]);
 const clearPreview=useCallback(()=>setDraft(null),[]);
 useEffect(()=>{
  const update=()=>{void refresh();};const visible=()=>{if(document.visibilityState==='visible')update();};
  window.addEventListener('focus',update);window.addEventListener('better-by-par:branding-updated',update);document.addEventListener('visibilitychange',visible);
  const timer=setInterval(update,60000);
  return()=>{requestRevision.current++;clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('better-by-par:branding-updated',update);document.removeEventListener('visibilitychange',visible);};
 },[refresh]);
 useEffect(()=>{setDraft(null);void refresh();},[pathname,refresh]);
 const club=clubs.find(c=>c.id===clubId);
 useEffect(()=>{
  const values=buildClubTheme(draft?.primary??club?.primaryColor,draft?.accent??club?.accentColor);
  for(const [key,value]of Object.entries(values))document.documentElement.style.setProperty(key,value);
  document.documentElement.dataset.clubTheme=club?.id??'platform';
  document.documentElement.style.colorScheme='light';
  if(club)try{sessionStorage.setItem(storageKey,club.id);}catch{}
  const meta=document.querySelector('meta[name="theme-color"]');meta?.setAttribute('content',values['--club-primary']);
 },[club,draft]);
 const value=useMemo(()=>({clubs,clubId:club?.id??'',setClubId,refresh,preview,clearPreview}),[clubs,club,refresh,setClubId,preview,clearPreview]);
 return <Theme.Provider value={value}>{children}</Theme.Provider>;
}
