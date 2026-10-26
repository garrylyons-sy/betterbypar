export type DiaryRange={day:number;start:string;end:string};
export const reminderChoices:number[];
export function reminderMinutes(value?:unknown):number;
export function lessonText(value:unknown,max:number,label:string):string;
export function dublinDate(value?:Date|string):string;
export function addDays(date:string,days:number):string;
export function weekStart(value?:string):string;
export function normalizeRanges(value:unknown):DiaryRange[];
