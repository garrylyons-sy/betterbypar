'use client';
import {ViewportPortal} from '@/components/viewport-portal';
import type {ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {Home,UserCircle,CalendarPlus,Menu} from 'lucide-react';
import {customerMenuItems,customerSection} from '@/lib/customer-navigation.mjs';
const icons={Home,'My Golf':UserCircle,Lessons:CalendarPlus,Club:CalendarPlus,Menu};
export function CustomerNavigation({children}:{children:ReactNode}){
 const section=customerSection(usePathname());if(!section)return <>{children}</>;
 const items=customerMenuItems.map(item=>{const Icon=icons[item.section],active=section===item.section;return <a key={item.section} href={item.href} aria-current={active?'page':undefined} className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-bold lg:flex-row lg:gap-2 lg:text-sm ${active?'bg-[var(--club-primary)] text-[var(--club-on-primary)]':'text-[var(--club-muted-text)]'}`}><Icon aria-hidden="true" className="h-4 w-4"/><span>{item.label}</span></a>;});
 return <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
  <nav aria-label="App menu" className="sticky top-0 z-40 hidden border-b border-[var(--club-border)] bg-[var(--club-surface)] p-3 lg:block"><div className="mx-auto grid max-w-xl grid-cols-5 gap-1">{items}</div></nav>
  {children}
  <ViewportPortal><nav aria-label="App menu" data-mobile-app-menu className="mobile-app-menu border-t border-[var(--club-border)] bg-[var(--club-surface)] px-2 pt-2 shadow-elevated lg:hidden"><div className="mx-auto grid max-w-xl grid-cols-5 gap-1">{items}</div></nav></ViewportPortal>
 </div>;
}
