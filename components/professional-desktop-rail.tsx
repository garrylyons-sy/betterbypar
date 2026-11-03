'use client';
import {CustomerDesktopRail} from '@/components/workspace-navigation';
/** Compatibility wrapper: all roles share the same responsive navigation components. */
export function ProfessionalDesktopRail({clubName,clubId,activeSection,onNavigate,underHeader=false}:{clubName:string;clubId?:string;activeSection:string;onNavigate?:(section:string)=>void;underHeader?:boolean}){return <CustomerDesktopRail clubName={clubName} clubId={clubId} roles={['Golf Professional']} activeSection={activeSection} onSelect={onNavigate} underHeader={underHeader}/>;}
