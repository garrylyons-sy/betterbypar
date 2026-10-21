export const notificationOpenEvent: string;
export function notificationDestination(value: unknown, contexts?: {id:string;name:string;role:string;club:string;league?:string;season?:string}[]): {href:string;page:'Home'|'Fixtures'|'Match'|'Results'|'Ladder'|'Competitions'|'Last Man Standing'|null;fixtureId:string;contextId:string|null;inbox:boolean};
export function openNotificationHref(value: unknown): void;
