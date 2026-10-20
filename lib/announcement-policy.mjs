import {createHash} from 'node:crypto';
import {notificationRoles,normalizeNotificationPreferences,isNotificationEligible} from './notification-policy.mjs';
export const announcementUuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateAnnouncementDraft(input) {
 const v=input&&typeof input==='object'?input:{};
 const title=typeof v.title==='string'?v.title.trim():'',body=typeof v.body==='string'?v.body.trim():'';
 if(!title||title.length>120)throw new Error('Title must contain 1 to 120 characters.');
 if(!body||body.length>2000)throw new Error('Message must contain 1 to 2000 characters.');
 const a=v.audience;
 if(!a||!Array.isArray(a.roles)||a.roles.some(r=>!notificationRoles.includes(r)))throw new Error('Choose valid audience roles.');
 for(const key of ['clubId','teamId'])if(a[key]!==null&&(typeof a[key]!=='string'||!announcementUuidPattern.test(a[key])))throw new Error('Choose a valid club and team.');
 if(a.teamId&&!a.clubId)throw new Error('Select a club before a team.');
 return {title,body,audience:{roles:[...new Set(a.roles)].sort(),clubId:a.clubId?.toLowerCase()??null,teamId:a.teamId?.toLowerCase()??null}};
}
export function announcementSelection(rows,config) {
 const unique=[...new Map(rows.map(row=>[row.personId,row])).values()];
 const summary={matched:unique.length,eligible:0,excluded:0,inbox:0,push:0,skipped:0,enabled:config.enabled,announcementsEnabled:config.enabledTypes.includes('announcement')};
 const recipients=[];
 for(const row of unique){
 if(!isNotificationEligible(row.roles,config)){summary.excluded++;continue;}
 summary.eligible++;
 const p=normalizeNotificationPreferences(row.preferences),inbox=summary.announcementsEnabled&&p.inboxTypes.includes('announcement'),push=summary.announcementsEnabled&&p.pushEnabled&&p.pushTypes.includes('announcement')&&Boolean(row.hasPush);
 if(inbox)summary.inbox++;if(push)summary.push++;
 if(inbox||push)recipients.push({personId:row.personId,inbox,push});else summary.skipped++;
 }
 return {summary,recipients};
}
export function announcementPreviewToken(draft,recipients,config) {
 return createHash('sha256').update(JSON.stringify({draft,recipients:[...recipients].sort((a,b)=>a.personId.localeCompare(b.personId)),config:{enabled:config.enabled,eligibleRoles:[...config.eligibleRoles].sort(),enabledTypes:[...config.enabledTypes].sort(),quietStart:config.quietStart,quietEnd:config.quietEnd}})).digest('hex');
}
