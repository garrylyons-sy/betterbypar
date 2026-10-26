'use client';
import {CalendarPlus,Flag,UserRound,Users,Settings2,CalendarDays} from 'lucide-react';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {GolfSummary} from '@/components/golf-summary';
import type {TeamContext} from '@/lib/types';
export function GolfHome({club,page,onNavigate}:{club:TeamContext;page:'Home'|'Club'|'Menu';onNavigate:(page:'My Golf'|'Lessons'|'Club')=>void}){
 const professional=['Golf Professional','Assistant Professional'].includes(club.role);
 const links=[{label:'My profile',href:'/profile',icon:UserRound,description:'Your photo and account details.'},{label:'My dependants',href:'/family',icon:Users,description:'Manage the junior players in your care.'},...(professional?[{label:'Lesson diary',href:'/lessons/manage',icon:CalendarDays,description:'Your schedule, groups and coaching notes.'}]:[]),...(club.role==='Club Admin'?[{label:'Club administration',href:'/clubadmin',icon:Settings2,description:'Branding, lessons and member relationships.'}]:[])];
 return <div className="grid gap-4">
  {page==='Home'&&<GolfSummary clubName={club.club}/>}
  {page!=='Menu'&&<Card><CardHeader><CardTitle>{page==='Club'?club.club:'Your golf'}</CardTitle></CardHeader><CardContent className="grid gap-4">
   {page==='Home'&&<p className="text-sm text-muted-foreground">Lessons, practice and progress at {club.club}.</p>}
   <div className="grid grid-cols-3 gap-2 sm:gap-3">{[{label:'Lessons',page:'Lessons' as const,icon:CalendarPlus,description:'Find a professional and book a lesson.'},{label:'My Golf',page:'My Golf' as const,icon:Flag,description:'Your lessons, feedback and practice drills.'},{label:'Club',page:'Club' as const,icon:Users,description:club.club}].filter(item=>page!=='Club'||item.page!=='Club').map(item=><button key={item.page} onClick={()=>onNavigate(item.page)} className="grid min-h-24 content-start gap-2 rounded-xl border border-border bg-muted p-3 sm:p-4 text-left text-foreground hover:bg-background"><item.icon className="h-5 w-5 text-primary"/><span className="font-extrabold">{item.label}</span><span className="hidden text-xs leading-5 text-muted-foreground sm:block">{item.description}</span></button>)}</div>
  </CardContent></Card>}
  <Card><CardHeader><CardTitle>{page==='Menu'?'More':professional?'Your coaching':'Your account'}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{links.map(item=><a href={item.href} key={item.href} className="flex min-h-20 items-center gap-3 rounded-xl border border-border p-4 hover:bg-muted"><item.icon className="h-5 w-5 shrink-0 text-primary"/><span><span className="block font-bold">{item.label}</span><span className="mt-1 block text-xs text-muted-foreground">{item.description}</span></span></a>)}</CardContent></Card>
 </div>;
}
