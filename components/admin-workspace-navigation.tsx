'use client';
import {useEffect,useState} from 'react';
import {Menu} from 'lucide-react';
import {WorkspaceDesktopRail,WorkspaceBottomNavigation,WorkspaceMoreMenu,type WorkspaceMenuItem} from '@/components/workspace-navigation';
export function AdminWorkspaceNavigation({items,activeSection,onSelect,clubPortal=false}:{items:WorkspaceMenuItem[];activeSection:string;onSelect:(id:string)=>void;clubPortal?:boolean}){
 const [moreOpen,setMoreOpen]=useState(false);
 useEffect(()=>{if(!moreOpen)return;const media=window.matchMedia('(min-width: 1024px)');const closeOnDesktop=()=>{if(media.matches)setMoreOpen(false);};closeOnDesktop();media.addEventListener('change',closeOnDesktop);return()=>media.removeEventListener('change',closeOnDesktop);},[moreOpen]);
 const preferred=clubPortal?['clubs','lessons','shop','challenges']:['desktop','clubs','people','lessons','shop'];
 const primary=preferred.map(id=>items.find(item=>item.id===id)).filter((item):item is WorkspaceMenuItem=>Boolean(item)).slice(0,4),remaining=items.filter(item=>!primary.some(primary=>primary.id===item.id));
 const mobileItems=[...primary,...(remaining.length?[{id:'__more',label:'More',icon:Menu}]:[])],section=activeSection==='invites'?'people':activeSection;
 return <><WorkspaceDesktopRail title={clubPortal?'Club admin':'Administration'} kicker={clubPortal?'Your club':'Platform'} items={items} activeSection={section} onSelect={onSelect} underHeader/><WorkspaceBottomNavigation items={mobileItems} activeSection={primary.some(item=>item.id===section)?section:'__more'} onSelect={id=>id==='__more'?setMoreOpen(true):onSelect(id)}/>{moreOpen&&<WorkspaceMoreMenu items={remaining} onSelect={onSelect} onClose={()=>setMoreOpen(false)}/>}</>;
}
