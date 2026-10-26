import {safeNotificationHref} from './notification-policy.mjs';
export const notificationOpenEvent='interclub:notification-open';
export function notificationDestination(value,contexts=[]) {
  const href=safeNotificationHref(value);
  const params=new URL(href,'https://app.invalid').searchParams;
  const requested=params.get('page');
  const pages=['Home','Fixtures','Match','Results','Ladder','Competitions','Last Man Standing','Live matches'];
  const filters=['team','role','club','league','season'].map(key=>params.get(key)?.trim().toLowerCase());
  const context=filters.some(Boolean)?contexts.find(item=>[item.name,item.role,item.club,item.league,item.season].every((value,i)=>!filters[i]||value?.trim().toLowerCase()===filters[i])):null;
  const rawMessage=params.get('message');
  const messageId=rawMessage&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawMessage)?rawMessage.toLowerCase():null;
  const rawStream=params.get('stream');
  const streamId=rawStream&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawStream)?rawStream.toLowerCase():null;
  return {href,messageId,streamId,page:pages.includes(requested)?requested:null,fixtureId:params.get('fixtureId')??'',contextId:context?.id??null,inbox:params.get('notifications')==='1'};
}
export function openNotificationHref(value) {
  const {href}=notificationDestination(value);
  if(new URL(href,window.location.origin).pathname!=='/'){window.location.assign(href);return;}
  window.history.replaceState(null,'',href);
  window.dispatchEvent(new CustomEvent(notificationOpenEvent,{detail:{href}}));
}
