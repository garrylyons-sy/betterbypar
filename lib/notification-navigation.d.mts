export const notificationOpenEvent: string;
export function notificationDestination(value: unknown, contexts?: {id:string;name:string;role:string;club:string;league?:string;season?:string}[]): {href:string;messageId:string|null;streamId:string|null;page:'Home'|'Fixtures'|'Match'|'Results'|'Ladder'|'Competitions'|'Last Man Standing'|'Live matches'|null;fixtureId:string;contextId:string|null;inbox:boolean};
export function openNotificationHref(value: unknown): void;
