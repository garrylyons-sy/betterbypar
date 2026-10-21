'use client';
import {useEffect,useState} from 'react';
import type {Preferences,NotificationType} from '@/lib/notification-policy.mjs';
type Summary={eligible:boolean;enabled:boolean;activeAccount:boolean;preferences:Preferences;enabledTypes:NotificationType[];devices:number;pushReady:boolean};
const types:{key:NotificationType;label:string}[]=[{key:'lineup_published',label:'Opponents published'},{key:'match_result',label:'Match results'},{key:'announcement',label:'Announcements & cup draws'},{key:'fixture_change',label:'Fixture changes'},{key:'lineup_reminder',label:'Team publication deadlines'},{key:'ladder_challenge',label:'Ladder challenges'}];
export function AdminPersonNotifications({personId}:{personId:string}){
  const [state,setState]=useState<{personId:string;data:Summary|null;error:string}|null>(null);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setState(null);
    void fetch(`/api/admin/people/notifications?personId=${encodeURIComponent(personId)}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load notification settings.');if(!controller.signal.aborted)setState({personId,data,error:''});})
      .catch(reason=>{if(!controller.signal.aborted)setState({personId,data:null,error:reason.message});});
    return ()=>controller.abort();
  },[personId,revision]);
  const data=state?.personId===personId?state.data:null;
  const error=state?.personId===personId?state.error:'';
  const inboxOn=Boolean(data?.eligible&&data.preferences.inboxTypes.some(type=>data.enabledTypes.includes(type)));
  const pushOn=Boolean(data?.eligible&&data.pushReady&&data.preferences.pushEnabled&&data.devices&&data.preferences.pushTypes.some(type=>data.enabledTypes.includes(type)));
  const pushLabel=pushOn?'On':!data?.eligible?'Unavailable':!data?.pushReady?'Not configured':!data.preferences.pushEnabled?'Off':!data.devices?'No device':'Off';
  return <section aria-label="Person notification settings" className="mt-4 rounded-xl bg-[#f7f5fa] px-3 py-2 ring-1 ring-[#eeeaf2]">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><h3 className="font-extrabold text-[#10233f]">Notifications</h3>{data?<><span>Inbox: <strong>{inboxOn?'On':data.eligible?'Off':'Unavailable'}</strong></span><span>Push: <strong>{pushLabel}</strong></span><span>{data.devices} device{data.devices===1?'':'s'}</span></>:error?<span role="alert">{error} <button type="button" className="font-bold underline" onClick={()=>setRevision(value=>value+1)}>Retry</button></span>:<span role="status">Loading…</span>}</div>
    {data && <>
      {!data.eligible && <p className="mt-1 text-[11px] text-[#6c5a73]">{!data.activeAccount?'No active login.':!data.enabled?'Notifications are switched off globally.':'Outside the current notification rollout.'}</p>}
      <details className="mt-1 text-[11px] text-[#6c5a73]"><summary className="cursor-pointer font-semibold">Alert types · managed by player</summary><table className="mt-1 w-full text-left"><caption className="sr-only">Saved notification preferences</caption><thead><tr><th className="py-1 font-semibold">Saved preferences</th><th className="text-center font-semibold">Inbox</th><th className="text-center font-semibold">Push</th></tr></thead><tbody>{types.map(type=><tr key={type.key}><th scope="row" className="py-0.5 font-normal">{type.label}{!data.enabledTypes.includes(type.key)?' (disabled globally)':''}</th><td className="text-center">{data.preferences.inboxTypes.includes(type.key)?'On':'Off'}</td><td className="text-center">{data.preferences.pushTypes.includes(type.key)?'On':'Off'}</td></tr>)}</tbody></table><p className="mt-1">Push opt-in: {data.preferences.pushEnabled?'On':'Off'}. Device count shows registered devices; phone permissions can also affect delivery.</p></details>
    </>}
  </section>;
}
