import {withCupDrawWitness} from './cup-draw-inbox.mjs';
import {cupDrawPresentation} from './cup-draw-presentation.mjs';
import {normalizeNotificationPreferences,isNotificationEligible} from './notification-policy.mjs';
export const cupDrawAudiences=[{key:'chairs',label:'League Chairs'},{key:'admins',label:'Admins'},{key:'managers',label:'Managers of teams in this competition'},{key:'players',label:'Players on teams in this competition'}];
export function validateCupDrawAudience(value){
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.some(key=>!cupDrawAudiences.some(a=>a.key===key)))throw new Error('Choose a valid cup draw notification audience.');
 return [...new Set(value)];
}
export function cupDrawMessage(name,snapshot,details={}){
 const date=value=>new Date(`${value}T12:00:00Z`).toLocaleDateString('en-IE',{timeZone:'Europe/Dublin',day:'numeric',month:'short',year:'numeric'});
 const view=cupDrawPresentation(snapshot);
 const rounds=view.rounds.map((round,index)=>`${round.name} — ${date(round.date)}${index<(view.byes?2:1)?`\n${round.ties.map(t=>`${t.number}. ${t.home}${t.homeBye?' (bye)':''} v ${t.away}${t.awayBye?' (bye)':''}`).join('\n')}`:''}`);
 return withCupDrawWitness(`${name} draw is confirmed.${view.byes?` ${view.byes} ${view.byes===1?'team has a bye':'teams have byes'} into ${view.rounds[1]?.name}.`:''}\n\n${rounds.join('\n\n')}`,details);
}
export function selectCupDrawRecipients(rows,config){
 const unique=new Map();for(const row of rows)if(!unique.has(row.personId))unique.set(row.personId,row);
 const summary={matched:unique.size,eligible:0,excluded:0,inbox:0,push:0,skipped:0,notified:0};const recipients=[];
 for(const row of unique.values()){
  if(!isNotificationEligible(row.roles,config)){summary.excluded++;continue;}summary.eligible++;
  const p=normalizeNotificationPreferences(row.preferences),enabled=config.enabledTypes.includes('announcement');
  const inbox=enabled&&p.inboxTypes.includes('announcement'),push=enabled&&p.pushEnabled&&p.pushTypes.includes('announcement')&&Boolean(row.hasPush);
  if(inbox)summary.inbox++;if(push)summary.push++;
  if(inbox||push)recipients.push({personId:row.personId,inbox,push});else summary.skipped++;
 }
 summary.notified=recipients.length;return {summary,recipients};
}
// Inbox always retains the complete draw. Bound only the phone transport preview.
export function cupDrawPushPayload(payload){
 const size=value=>new TextEncoder().encode(JSON.stringify(value)).length;
 if(size(payload)<=3800)return payload;
 const suffix='\nOpen your Interclub Snooker inbox for the full draw.';
 const points=Array.from(payload.body);let low=0,high=points.length;
 while(low<high){const mid=Math.ceil((low+high)/2);if(size({...payload,body:points.slice(0,mid).join('')+suffix})<=3800)low=mid;else high=mid-1;}
 return {...payload,body:points.slice(0,low).join('')+suffix};
}
