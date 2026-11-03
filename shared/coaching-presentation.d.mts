import type {CoachingSlot} from './coaching-contracts';
export function coachingDay(value:string|Date):string;
export function coachingAddDays(date:string,days:number):string;
export function coachingWeek(date?:string):string;
export function coachingSlotState(slot:CoachingSlot,now?:number):{past:boolean;bookable:boolean;label:string};
export function coachingSessionInstant(date:string,time:string):string;
