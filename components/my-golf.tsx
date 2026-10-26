'use client';
import {useState} from 'react';
import {Flag,CalendarDays,Target} from 'lucide-react';
import {PlayerPractice} from '@/components/player-practice';
import {RoundJournal} from '@/components/round-journal';
import {MemberLessons} from '@/components/member-lessons';
export function MyGolf(){
 const [tab,setTab]=useState<'rounds'|'lessons'|'practice'>('rounds');
 return <div className="space-y-5"><nav aria-label="My Golf sections" className="grid grid-cols-3 gap-2 rounded-2xl bg-[var(--club-soft)] p-2">{[{key:'rounds' as const,label:'Rounds',icon:Flag},{key:'practice' as const,label:'Practice',icon:Target},{key:'lessons' as const,label:'Lessons',icon:CalendarDays}].map(item=><button key={item.key} aria-pressed={tab===item.key} onClick={()=>setTab(item.key)} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold ${tab===item.key?'bg-[var(--club-primary)] text-[var(--club-on-primary)]':''}`}><item.icon className="h-4 w-4"/>{item.label}</button>)}</nav><div hidden={tab!=='rounds'}><RoundJournal/></div>{tab==='practice'&&<PlayerPractice/>}{tab==='lessons'&&<MemberLessons personalView embedded/>}</div>;
}
