'use client';
import type {ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {CustomerDesktopRail,WorkspaceBottomNavigation,customerWorkspaceItems} from '@/components/workspace-navigation';
import {customerSection} from '@/lib/customer-navigation.mjs';
import {useClubTheme} from '@/components/club-theme-provider';
export function CustomerNavigation({children}:{children:ReactNode}){
 const {ready,clubs,clubId}=useClubTheme(),club=clubs.find(club=>club.id===clubId),roles=club?.roles??[];
 const section=customerSection(usePathname(),roles);if(ready===false||!section)return <>{children}</>;
 return <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0"><div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-6 lg:px-8 lg:pb-8 lg:pt-4 xl:grid-cols-[230px_minmax(0,1fr)] xl:px-10"><CustomerDesktopRail clubName={club?.name??'Your club'} clubId={clubId} roles={roles} activeSection={section}/><div className="min-w-0 w-full lg:[&>main]:m-0 lg:[&>main]:max-w-none lg:[&>main]:p-0">{children}</div></div><WorkspaceBottomNavigation items={customerWorkspaceItems(roles,clubId)} activeSection={section}/></div>;
}
