import {normalizeNotificationPreferences,isNotificationEligible} from './notification-policy.mjs';
export const cupDrawAudiences=[{key:'chairs',label:'League Chairs'},{key:'admins',label:'Admins'},{key:'managers',label:'Managers of teams in this competition'},{key:'players',label:'Players on teams in this competition'}];
export function validateCupDrawAudience(value){
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.some(key=>!cupDrawAudiences.some(a=>a.key===key)))throw new Error('Choose a valid cup draw notification audience.');
 return [...new Set(value)];
}
export function cupDrawMessage(name,snapshot){
 const teams=new Map(snapshot.entries.map(e=>[e.team_id,e.team_name]));
 const date=value=>new Date(`${value}T12:00:00Z`).toLocaleDateString('en-IE',{timeZone:'Europe/Dublin',day:'numeric',month:'short',year:'numeric'});
 const first=snapshot.rounds.find(r=>r.round_number===1);
 const lines=snapshot.bracket.filter(t=>t.roundNumber===1).map(t=>`${t.matchNumber}. ${teams.get(t.homeTeamId)??'To be decided'}${t.status==='Bye'?' — Bye':` v ${teams.get(t.awayTeamId)??'To be decided'}`}`);
 const later=snapshot.rounds.filter(r=>r.round_number>1).map(r=>`${r.name}: ${date(r.fixture_date)}`);
 return `${name} draw is confirmed.\n\n${first?.name??'First round'}${first?` — ${date(first.fixture_date)}`:''}\n${lines.join('\n')}${later.length?`\n\n${later.join('\n')}\nLater rounds follow the bracket in match order.`:''}`;
}
export function selectCupDrawRecipients(rows,config){
 const unique=new Map();for(const row of rows)if(!unique.has(row.personId))unique.set(row.personId,row);
 const summary={matched:unique.size,eligible:0,excluded:0,inbox:0,push:0,skipped:0,notified:0};const recipients=[];
 for(const row of unique.values()){
  if(!isNotificationEligible(row.roles,config)){summary.excluded++;continue;}summary.eligible++;
  const p=normalizeNotificationPreferences(row.preferences),enabled=config.enabledTypes.includes('cup_draw');
  const inbox=enabled&&p.inboxTypes.includes('cup_draw'),push=enabled&&p.pushEnabled&&p.pushTypes.includes('cup_draw')&&Boolean(row.hasPush);
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
