export const notificationTypes = ['fixture_change','match_reminder','lineup_reminder','ladder_challenge'];
export const notificationRoles = ['Player','Manager','Club Member','Club Admin','League Chair','Administrator'];
export const defaultNotificationConfig = {enabled:true,eligibleRoles:['League Chair'],enabledTypes:[...notificationTypes],matchReminderHours:24,lineupReminderHours:4,ladderReminderHours:24,quietStart:'22:00',quietEnd:'08:00'};
export const defaultNotificationPreferences = {inboxTypes:[...notificationTypes],pushTypes:[...notificationTypes],pushEnabled:false};
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const list = (value,allowed,fallback) => Array.isArray(value) ? [...new Set(value.filter(x=>allowed.includes(x)))] : [...fallback];
export function normalizeNotificationConfig(input) {
 const v=record(input), d=defaultNotificationConfig;
 const result={...d,enabled:typeof v.enabled==='boolean'?v.enabled:d.enabled,eligibleRoles:list(v.eligibleRoles,notificationRoles,d.eligibleRoles),enabledTypes:list(v.enabledTypes,notificationTypes,d.enabledTypes)};
 for(const key of ['matchReminderHours','lineupReminderHours','ladderReminderHours']) result[key]=Number.isInteger(v[key])&&v[key]>=1&&v[key]<=168?v[key]:d[key];
 for(const key of ['quietStart','quietEnd']) result[key]=typeof v[key]==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v[key])?v[key]:d[key];
 return result;
}
export function validateNotificationConfig(input) {
 const v=record(input);
 if(typeof v.enabled!=='boolean'||!Array.isArray(v.eligibleRoles)||v.eligibleRoles.some(x=>!notificationRoles.includes(x))||!Array.isArray(v.enabledTypes)||v.enabledTypes.some(x=>!notificationTypes.includes(x))) throw new Error('Invalid notification settings.');
 for(const key of ['matchReminderHours','lineupReminderHours','ladderReminderHours']) if(!Number.isInteger(v[key])||v[key]<1||v[key]>168) throw new Error('Reminder hours must be between 1 and 168.');
 for(const key of ['quietStart','quietEnd']) if(typeof v[key]!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v[key])) throw new Error('Quiet hours must use HH:MM.');
 return normalizeNotificationConfig(v);
}
export function normalizeNotificationPreferences(input) { const v=record(input); return {inboxTypes:list(v.inboxTypes,notificationTypes,notificationTypes),pushTypes:list(v.pushTypes,notificationTypes,notificationTypes),pushEnabled:v.pushEnabled===true}; }
export function validateNotificationPreferences(input) { const v=record(input); if(typeof v.pushEnabled!=='boolean'||['inboxTypes','pushTypes'].some(k=>!Array.isArray(v[k])||v[k].some(x=>!notificationTypes.includes(x)))) throw new Error('Invalid notification preferences.'); return normalizeNotificationPreferences(v); }
export function isNotificationEligible(roles,config) {return config.enabled && roles.some(role=>config.eligibleRoles.includes(role));}
export function isQuietTime(now,config) { if(config.quietStart===config.quietEnd)return false; const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Dublin',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now); return config.quietStart<config.quietEnd?time>=config.quietStart&&time<config.quietEnd:time>=config.quietStart||time<config.quietEnd; }
export function canDeliverPush(n,p,c,roles,now=new Date()) {return isNotificationEligible(roles,c)&&c.enabledTypes.includes(n.type)&&p.pushEnabled&&p.pushTypes.includes(n.type)&&!(n.readAt||n.read_at)&&(!(n.expiresAt||n.expires_at)||new Date(n.expiresAt||n.expires_at)>now)&&!isQuietTime(now,c);}
export function safeNotificationHref(href) {return typeof href==='string'&&href.startsWith('/')&&!href.startsWith('//')&&!/[\\\u0000-\u0020\u007f]/.test(href)?href:'/';}
export function reminderIsDue(deadline,hours,now=new Date()) {const remaining=new Date(deadline).getTime()-now.getTime();return Number.isFinite(remaining)&&remaining>0&&remaining<=hours*3600000;}
export function fixtureEventKey(id,date) {return `fixture:${id}:${new Date(date).toISOString()}`;}
