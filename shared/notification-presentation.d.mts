import type {NotificationType} from '../lib/notification-policy.mjs';
export const golfNotificationCategories:{type:NotificationType;label:string}[];
export function nativeNotificationDestination(value:unknown):{kind:'message';id:string}|{kind:'native';pathname:'/lessons'|'/my-golf'|'/inbox';params:Record<string,string>}|{kind:'web';href:string};
export function notificationDate(value:string):string;
