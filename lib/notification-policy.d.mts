export type NotificationType = 'fixture_change' | 'match_reminder' | 'lineup_reminder' | 'ladder_challenge' | 'announcement' | 'lineup_published' | 'match_result' | 'cup_draw' | 'livestream';
export type Config = {version:4;enabled:boolean;retentionDays:number;eligibleRoles:string[];enabledTypes:NotificationType[];lineupDeadlineHours:number;matchReminderHours:number;lineupReminderHours:number;ladderReminderHours:number;quietStart:string;quietEnd:string};
export type Preferences = {version:4;inboxTypes:NotificationType[];pushTypes:NotificationType[];pushEnabled:boolean};
export const notificationTypes: NotificationType[];
export const transientPushNotificationTypes: NotificationType[];
export const notificationRoles: string[];
export const defaultNotificationConfig: Config;
export const defaultNotificationPreferences: Preferences;
export function normalizeNotificationConfig(input:unknown):Config;
export function validateNotificationConfig(input:unknown):Config;
export function normalizeNotificationPreferences(input:unknown):Preferences;
export function validateNotificationPreferences(input:unknown):Preferences;
export function isNotificationEligible(roles:string[],config:Config):boolean;
export function isEligibleForNotification(type:string,roles:string[],config:Config):boolean;
export function isQuietTime(now:Date,config:Config):boolean;
export function canDeliverPush(notification:{type:string;readAt?:unknown;read_at?:unknown;expiresAt?:string|Date|null;expires_at?:string|Date|null},preferences:Preferences,config:Config,roles:string[],now?:Date):boolean;
export function safeNotificationHref(href:unknown):string;
export function reminderIsDue(deadline:string|Date,hours:number,now?:Date):boolean;
export function fixtureEventKey(id:string,date:string|Date):string;
export const notificationLifetimeMs:number;
export function notificationLifetimeMsFor(days?:number):number;
export function isNotificationWithinLifetime(createdAt:string|Date,now?:number,days?:number):boolean;
export function pruneNotificationInbox<T extends {items:{createdAt:string;readAt:unknown}[];unreadCount:number;config?:{retentionDays?:number}}>(state:T,now?:number):T;

export function notificationRoleLabel(role:string):string;

export function lineupReminderTiming(kickoff:string|Date,deadlineHours?:number,now?:Date):{deadlineAt:Date;remindAt:Date;due:boolean};

export function notificationPreferenceType(type:NotificationType):NotificationType;
