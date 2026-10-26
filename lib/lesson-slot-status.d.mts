export type LessonSlotState='available'|'busy'|'partial'|'inactive';
export function lessonSlotStatus(slot:{active:boolean;starts_at:string;ends_at:string;booking_id?:string|null;group_id?:string|null;group_mode?:string;capacity?:number|null;booked_count?:number},now?:number):{state:LessonSlotState;label:string};
