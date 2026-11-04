'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {selectedClubId} from '@/shared/club-selection.mjs';
import {buildClubTheme} from '@/lib/club-theme.mjs';
type Club={roles?:string[];id:string;name:string;primaryColor:string|null;accentColor:string|null};
type ThemeContext={ready?:boolean;clubs:Club[];clubId:string;setClubId:(id:string)=>void;refresh:()=>Promise<void>;preview:(primary:string,accent:string)=>void;clearPreview:()=>void};
const Theme=createContext<ThemeContext>({ready:false,clubs:[],clubId:'',setClubId:()=>{},refresh:async()=>{},preview:()=>{},clearPreview:()=>{}});
export const useClubTheme=()=>useContext(Theme);
const storageKey='better-by-par:active-club';
export function ClubThemeProvider({children}:{children:React.ReactNode}){
 const pathname=usePathname();
 const [clubs,setClubs]=useState<Club[]>([]),[clubId,setSelected]=useState(''),[draft,setDraft]=useState<{primary:string;accent:string}|null>(null);
 const selectionAccess=useRef<{canSwitchClub:boolean;defaultClubId?:string|null}>({canSwitchClub:false});
 const requestRevision=useRef(0),[ready,setReady]=useState(false);
 const refresh=useCallback(async()=>{
  const revision=++requestRevision.current;
  try{
   const response=await fetch('/api/club-theme',{cache:'no-store',credentials:'same-origin'});
   if(!response.ok&&response.status!==401)return;
   const data=await response.json();if(revision!==requestRevision.current)return;
   const rows:Club[]=response.status===401?[]:data.clubs??[];setClubs(rows);
   selectionAccess.current={canSwitchClub:response.status!==401&&data.canSwitchClub===true,defaultClubId:data.defaultClubId};
   let saved='';try{saved=sessionStorage.getItem(storageKey)??'';}catch{}
   const requested=new URLSearchParams(window.location.search).get('clubId');
   setSelected(current=>selectedClubId({clubs:rows,...selectionAccess.current},requested&&rows.some(c=>c.id===requested)?requested:current||saved));
  }catch{/* Keep the last confirmed theme during transient connection failures. */}finally{if(revision===requestRevision.current)setReady(true);}
 },[]);
 const setClubId=useCallback((id:string)=>{if(id&&selectionAccess.current.canSwitchClub)setSelected(id);},[]);
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
 const platformAdmin=pathname==='/admin'||pathname.startsWith('/admin/');
 useEffect(()=>{
  const values=platformAdmin ? buildClubTheme() : buildClubTheme(draft?.primary??club?.primaryColor,draft?.accent??club?.accentColor);
  for(const [key,value]of Object.entries(values))document.documentElement.style.setProperty(key,value);
  document.documentElement.dataset.clubTheme=platformAdmin?'platform':club?.id??'platform';
  document.documentElement.style.colorScheme='light';
  if(club)try{sessionStorage.setItem(storageKey,club.id);}catch{}
  const meta=document.querySelector('meta[name="theme-color"]');meta?.setAttribute('content',values['--club-primary']);
 },[club,draft,platformAdmin]);
 const value=useMemo(()=>({ready,clubs,clubId:club?.id??'',setClubId,refresh,preview,clearPreview}),[ready,clubs,club,refresh,setClubId,preview,clearPreview]);
 return <Theme.Provider value={value}>{children}</Theme.Provider>;
}
