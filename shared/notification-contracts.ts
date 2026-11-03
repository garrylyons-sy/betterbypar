import type {Preferences,Config,NotificationType} from '../lib/notification-policy.mjs';
export type InboxItem={id:string;type:NotificationType;title:string;body:string;href:string;createdAt:string;readAt:string|null};
export type NotificationInbox={eligible:boolean;items:InboxItem[];unreadCount:number;preferences?:Preferences;config?:Config};
export type NotificationMessage={id:string;announcementId:string;title:string;body:string;createdAt:string;availableUntil:string};
export type NotificationReadiness={webPushReady:boolean;emailReady:boolean;nativePushReady:false};
