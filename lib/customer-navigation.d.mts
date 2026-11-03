export type CustomerSection='Home'|'My Golf'|'Lessons'|'Club'|'Menu';
export const customerMenuItems:{label:string;section:CustomerSection;href:string}[];
export function customerSection(pathname:string,roles?:string[]):CustomerSection|null;
export function customerRootPage(value:unknown):CustomerSection|null;

export function customerItems(roles?:string[]):{label:string;section:string;href:string}[];
