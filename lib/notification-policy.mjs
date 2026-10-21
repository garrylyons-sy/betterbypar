export const notificationTypes = ['fixture_change','match_reminder','lineup_reminder','ladder_challenge','announcement','lineup_published','match_result','cup_draw'];
export const notificationRoles = ['Player','Manager','Club Member','Club Admin','League Chair','Administrator'];
export const defaultNotificationConfig = {version:4,enabled:true,retentionDays:10,eligibleRoles:['League Chair'],enabledTypes:notificationTypes.filter(type=>type!=='match_reminder'),lineupDeadlineHours:2,matchReminderHours:24,lineupReminderHours:4,ladderReminderHours:24,quietStart:'22:00',quietEnd:'08:00'};
export const defaultNotificationPreferences = {version:4,inboxTypes:notificationTypes.filter(type=>type!=='match_reminder'),pushTypes:notificationTypes.filter(type=>!['match_reminder','announcement','lineup_published','match_result','cup_draw'].includes(type)),pushEnabled:false};
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const list = (value,allowed,fallback) => Array.isArray(value) ? [...new Set(value.filter(x=>allowed.includes(x)))] : [...fallback];
export function normalizeNotificationConfig(input) {
 const v=record(input), d=defaultNotificationConfig;
 const result={...d,version:4,enabled:typeof v.enabled==='boolean'?v.enabled:d.enabled,eligibleRoles:list(v.eligibleRoles,notificationRoles,d.eligibleRoles),enabledTypes:list(v.enabledTypes,notificationTypes,d.enabledTypes)};
 if((!v.version||v.version<2)&&!result.enabledTypes.includes('announcement'))result.enabledTypes.push('announcement');
 if(!v.version||v.version<3)for(const type of ['lineup_published','match_result'])if(!result.enabledTypes.includes(type))result.enabledTypes.push(type);
 if((!v.version||v.version<4)&&!result.enabledTypes.includes('cup_draw'))result.enabledTypes.push('cup_draw');
 for(const key of ['matchReminderHours','lineupReminderHours','ladderReminderHours']) result[key]=Number.isInteger(v[key])&&v[key]>=1&&v[key]<=168?v[key]:d[key];
 result.enabledTypes=result.enabledTypes.filter(type=>type!=='match_reminder');
 result.lineupDeadlineHours=typeof v.lineupDeadlineHours==='number'&&Number.isFinite(v.lineupDeadlineHours)&&v.lineupDeadlineHours>=0&&v.lineupDeadlineHours<=168?v.lineupDeadlineHours:d.lineupDeadlineHours;
 result.retentionDays=Number.isInteger(v.retentionDays)&&v.retentionDays>=1&&v.retentionDays<=365?v.retentionDays:d.retentionDays;
 for(const key of ['quietStart','quietEnd']) result[key]=typeof v[key]==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v[key])?v[key]:d[key];
 return result;
}
export function validateNotificationConfig(input) {
 const v=record(input);
 if(typeof v.enabled!=='boolean'||!Array.isArray(v.eligibleRoles)||v.eligibleRoles.some(x=>!notificationRoles.includes(x))||!Array.isArray(v.enabledTypes)||v.enabledTypes.some(x=>!notificationTypes.includes(x))) throw new Error('Invalid notification settings.');
 for(const key of ['matchReminderHours','lineupReminderHours','ladderReminderHours']) if(!Number.isInteger(v[key])||v[key]<1||v[key]>168) throw new Error('Reminder hours must be between 1 and 168.');
 if(v.lineupDeadlineHours!==undefined&&(typeof v.lineupDeadlineHours!=='number'||!Number.isFinite(v.lineupDeadlineHours)||v.lineupDeadlineHours<0||v.lineupDeadlineHours>168))throw new Error('Team publication deadline must be between 0 and 168 hours before the match.');
 if(v.retentionDays!==undefined&&(!Number.isInteger(v.retentionDays)||v.retentionDays<1||v.retentionDays>365))throw new Error('Retention days must be between 1 and 365.');
 for(const key of ['quietStart','quietEnd']) if(typeof v[key]!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v[key])) throw new Error('Quiet hours must use HH:MM.');
 return normalizeNotificationConfig(v);
}
export function normalizeNotificationPreferences(input) {
 const v=record(input);
 const inboxTypes=list(v.inboxTypes,notificationTypes,notificationTypes);
 if((!v.version||v.version<2)&&!inboxTypes.includes('announcement'))inboxTypes.push('announcement');
 if(!v.version||v.version<3)for(const type of ['lineup_published','match_result'])if(!inboxTypes.includes(type))inboxTypes.push(type);
 if((!v.version||v.version<4)&&!inboxTypes.includes('cup_draw'))inboxTypes.push('cup_draw');
 return {version:4,inboxTypes:inboxTypes.filter(type=>type!=='match_reminder'),pushTypes:list(v.pushTypes,notificationTypes,defaultNotificationPreferences.pushTypes).filter(type=>type!=='match_reminder'),pushEnabled:v.pushEnabled===true};
}
export function validateNotificationPreferences(input) { const v=record(input); if(typeof v.pushEnabled!=='boolean'||['inboxTypes','pushTypes'].some(k=>!Array.isArray(v[k])||v[k].some(x=>!notificationTypes.includes(x)))) throw new Error('Invalid notification preferences.'); return normalizeNotificationPreferences(v); }
export function isNotificationEligible(roles,config) {return config.enabled && roles.some(role=>config.eligibleRoles.includes(role));}
export function isQuietTime(now,config) { if(config.quietStart===config.quietEnd)return false; const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Dublin',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now); return config.quietStart<config.quietEnd?time>=config.quietStart&&time<config.quietEnd:time>=config.quietStart||time<config.quietEnd; }
export function canDeliverPush(n,p,c,roles,now=new Date()) {return isNotificationEligible(roles,c)&&c.enabledTypes.includes(n.type)&&p.pushEnabled&&p.pushTypes.includes(n.type)&&!(n.readAt||n.read_at)&&(!(n.expiresAt||n.expires_at)||new Date(n.expiresAt||n.expires_at)>now)&&!isQuietTime(now,c);}
export function safeNotificationHref(href) {return typeof href==='string'&&href.startsWith('/')&&!href.startsWith('//')&&!/[\\\u0000-\u0020\u007f]/.test(href)?href:'/';}
export function reminderIsDue(deadline,hours,now=new Date()) {const remaining=new Date(deadline).getTime()-now.getTime();return Number.isFinite(remaining)&&remaining>0&&remaining<=hours*3600000;}
export function fixtureEventKey(id,date) {return `fixture:${id}:${new Date(date).toISOString()}`;}
export const notificationLifetimeMs=10*24*60*60*1000;
export function notificationLifetimeMsFor(days=10) {return (Number.isInteger(days)&&days>=1&&days<=365?days:10)*24*60*60*1000;}
export function isNotificationWithinLifetime(createdAt,now=Date.now(),days=10) {const created=new Date(createdAt).getTime();return Number.isFinite(created)&&created+notificationLifetimeMsFor(days)>now;}
export function pruneNotificationInbox(state,now=Date.now()) {
 const items=state.items.filter(item=>isNotificationWithinLifetime(item.createdAt,now,state.config?.retentionDays));
 if(items.length===state.items.length)return state;
 const expiredUnread=state.items.filter(item=>!item.readAt&&!isNotificationWithinLifetime(item.createdAt,now,state.config?.retentionDays)).length;
 return {...state,items,unreadCount:Math.max(0,state.unreadCount-expiredUnread)};
}

export function notificationRoleLabel(role){return role==='Administrator'?'Admins':role;}

export function lineupReminderTiming(kickoff,deadlineHours=2,now=new Date()) {
 const hours=typeof deadlineHours==='number'&&Number.isFinite(deadlineHours)&&deadlineHours>=0&&deadlineHours<=168?deadlineHours:2;
 const deadlineAt=new Date(new Date(kickoff).getTime()-hours*3600000);
 const remindAt=new Date(deadlineAt.getTime()-3600000);
 return {deadlineAt,remindAt,due:Number.isFinite(deadlineAt.getTime())&&new Date(now).getTime()>=remindAt.getTime()&&new Date(now).getTime()<deadlineAt.getTime()};
}
