'use client';
import {useEffect, useState} from 'react';
import {AdminNotificationComposer} from '@/components/admin-notification-composer';
import {AdminAnnouncementHistory} from '@/components/admin-announcement-history';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {defaultNotificationConfig, validateNotificationConfig, notificationRoles,notificationRoleLabel} from '@/lib/notification-policy.mjs';

type Config = typeof defaultNotificationConfig;
const roles = notificationRoles;
const categories = [
  {key:'announcement',label:'Announcements',description:'Audience messages, confirmed cup draws and optional live-stream alerts to people with Viewing permission.'},
  {key:'lineup_published',label:'Opponents published',description:'Tell opposing managers when a team first publishes its line up.'},
  {key:'match_result',label:'Match results',description:'Final scores for League Chairs and all managers in the league, or managers of teams that have played in the cup.'},
  {key:'fixture_change',label:'Fixture changes',description:'Date changes, postponements and cancellations for affected teams, plus League Chair oversight.'},
  {key:'lineup_reminder',label:'Unpublished team deadline reminder',description:'Remind only managers of unpublished teams, one hour before the team publication deadline.'},
  {key:'ladder_challenge',label:'Ladder challenges',description:'New challenges and responses for the players involved.'}
] as const;
const reminderFields = [
  {key:'lineupDeadlineHours',label:'Teams must be published — hours before match'}
] as const;
function NotificationSettings({onMessage}:{onMessage:(message:string)=>void}) {
  const [draft,setDraft] = useState<Config>({...defaultNotificationConfig});
  const [saved,setSaved] = useState<Config | null>(null);
  const [ready,setReady] = useState(false);
  const [delivery,setDelivery] = useState<Record<string,number> | null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  useEffect(() => {
    let active=true;
    fetch('/api/admin/notifications',{cache:'no-store',credentials:'same-origin'})
      .then(async response => {
        const data=await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load notification settings.');
        if (active) {setDraft(data.config);setSaved(data.config);setReady(Boolean(data.push?.ready));setDelivery(data.delivery ?? null);}
      }).catch(reason => {if(active)setError(reason.message);}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[]);
  const changed=saved && JSON.stringify(saved)!==JSON.stringify(draft);
  async function save() {
    setSaving(true);setError('');
    try {
      const config=validateNotificationConfig(draft);
      const response=await fetch('/api/admin/notifications',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(config)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error || 'Could not save notification settings.');
      setDraft(data.config);setSaved(data.config);setReady(Boolean(data.push?.ready));setDelivery(data.delivery ?? null);
      window.dispatchEvent(new Event('interclub:notification-settings-changed'));
      onMessage('Notification settings saved. Audience restrictions apply immediately on the server.');
    }catch(reason){setError(reason instanceof Error ? reason.message : 'Could not save notification settings.');}
    finally{setSaving(false);}
  }
  return <Card><CardHeader><CardTitle>Notifications</CardTitle><p className="text-sm text-muted-foreground">Choose who can use the notification inbox and which events create alerts.</p></CardHeader>
    <CardContent className="space-y-5">
      {loading && <p role="status">Loading notification settings...</p>}
      {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
      {saved && <form className="space-y-6" onSubmit={event=>{event.preventDefault();void save();}}>
        <fieldset disabled={saving} className="space-y-6">
          <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={draft.enabled} onChange={event=>setDraft(current=>({...current,enabled:event.target.checked}))}/>Enable notifications</label>
          <label className="grid max-w-sm gap-2 text-sm font-bold">Keep notifications for (days)<input required type="number" min={1} max={365} step={1} value={Number.isFinite(draft.retentionDays)?draft.retentionDays:''} onChange={event=>setDraft(current=>({...current,retentionDays:event.target.value===''?NaN:Number(event.target.value)}))} className="h-11 w-full rounded-lg border bg-white px-3"/><span className="text-xs font-normal text-muted-foreground">Default: 10 days. Older messages are hidden from inboxes and are not downloaded or pushed. Applies to existing messages; database records and admin sent history are kept. Event deadlines can hide messages sooner.</span></label>
          <div className="space-y-3"><h3 className="font-extrabold">Who gets a notification inbox?</h3><p className="text-sm text-muted-foreground">These roles control general notification access. People with Viewing permission can also receive live-stream alerts, even when Viewing is not selected here. Those alerts still require notifications and Announcements to be enabled.</p>
            <div className="grid gap-3 sm:grid-cols-3">{roles.map(role=><label key={role} className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm font-bold"><input type="checkbox" checked={draft.eligibleRoles.includes(role)} onChange={event=>setDraft(current=>({...current,eligibleRoles:event.target.checked ? [...current.eligibleRoles,role] : current.eligibleRoles.filter(value=>value!==role)}))}/>{notificationRoleLabel(role)}</label>)}</div>
          </div>
          <div className="space-y-3"><h3 className="font-extrabold">Notification types</h3><div className="grid gap-3 sm:grid-cols-2">{categories.map(category=><label key={category.key} className="flex items-start gap-3 rounded-lg border p-3"><input className="mt-1" type="checkbox" checked={draft.enabledTypes.includes(category.key)} onChange={event=>setDraft(current=>({...current,enabledTypes:event.target.checked ? [...current.enabledTypes,category.key] : current.enabledTypes.filter(value=>value!==category.key)}))}/><span><span className="block text-sm font-bold">{category.label}</span><span className="text-sm text-muted-foreground">{category.description}</span></span></label>)}</div></div>
          <div className="grid gap-4 sm:grid-cols-3">{reminderFields.map(field=><label key={field.key} className="grid gap-2 text-sm font-bold"><span>{field.label}</span><input required type="number" min={0} max={168} step={0.5} value={Number.isFinite(draft[field.key]) ? draft[field.key] : ''} onChange={event=>setDraft(current=>({...current,[field.key]:event.target.value==='' ? NaN : Number(event.target.value)}))} className="h-11 w-full rounded-lg border bg-white px-3"/></label>)}</div>
          <p className="text-sm text-muted-foreground">The deadline defaults to 2 hours before the match (0 means kickoff). With a 19:30 match and a 2-hour deadline, teams are due by 17:30 and reminders target 16:30. Enable the unpublished team reminder above to use it. Only managers whose team is still unpublished are reminded. The worker checks approximately hourly; phone push also respects quiet hours. Date-only fixtures use a 19:30 start in Ireland.</p>
          <div className="space-y-3"><h3 className="font-extrabold">Quiet hours for phone push</h3><p className="text-sm text-muted-foreground">Europe/Dublin time. Inbox notifications still appear during quiet hours; phone alerts wait until quiet hours end. Use the same start and end time to turn quiet hours off.</p><div className="grid gap-4 sm:grid-cols-2">{(['quietStart','quietEnd'] as const).map(key=><label key={key} className="grid gap-2 text-sm font-bold">{key==='quietStart' ? 'Quiet hours start' : 'Quiet hours end'}<input required type="time" value={draft[key]} onChange={event=>setDraft(current=>({...current,[key]:event.target.value}))} className="h-11 rounded-lg border bg-white px-3"/></label>)}</div></div>
        </fieldset>
        <div className="rounded-lg bg-muted p-4"><p className="text-sm font-bold">Phone push: {ready ? 'Configured' : 'Not configured yet'}</p><p className="mt-1 text-sm text-muted-foreground">{ready ? 'People in the selected audience can enable notifications on each device.' : 'The inbox works without push. Phone delivery needs VAPID keys configured on the server.'}</p>{delivery && <p className="mt-2 text-xs text-muted-foreground">Push deliveries: {(delivery.Pending ?? 0)+(delivery.Sending ?? 0)} pending · {delivery.Sent ?? 0} sent · {delivery.Failed ?? 0} failed · {delivery.Skipped ?? 0} skipped</p>}</div>
        <div className="flex flex-wrap gap-3"><Button type="submit" disabled={saving || !changed}>{saving ? 'Saving...' : 'Save notification settings'}</Button><Button type="button" variant="outline" disabled={saving} onClick={()=>setDraft({...defaultNotificationConfig})}>Restore notification defaults</Button><Button type="button" variant="outline" disabled={saving || !changed} onClick={()=>{setDraft(saved);setError('');}}>Discard changes</Button></div>
      </form>}
    </CardContent></Card>;
}

export function AdminNotifications({onMessage}:{onMessage:(message:string)=>void}) {
  const [historyOpen,setHistoryOpen]=useState(false);
  const [settingsLoaded,setSettingsLoaded]=useState(false);
  const [historyRevision,setHistoryRevision]=useState(0);
  return <section className="space-y-4" aria-label="Notifications administration">
    <div><h2 className="text-2xl font-extrabold">Notifications</h2><p className="mt-1 text-sm text-muted-foreground">Send announcements, review sent messages and manage notification settings.</p></div>
    <details open className="rounded-xl border bg-white">
      <summary className="cursor-pointer p-4 font-extrabold">Send an announcement</summary>
      <div className="px-4 pb-4"><AdminNotificationComposer onMessage={onMessage} onSent={()=>setHistoryRevision(value=>value+1)}/></div>
    </details>
    <details className="rounded-xl border bg-white" onToggle={event=>setHistoryOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer p-4 font-extrabold">Sent announcements</summary>
      {historyOpen && <div className="px-4 pb-4"><AdminAnnouncementHistory key={historyRevision}/></div>}
    </details>
    <details className="rounded-xl border bg-white" onToggle={event=>{if(event.currentTarget.open)setSettingsLoaded(true);}}>
      <summary className="cursor-pointer p-4 font-extrabold">Notification settings</summary>
      {settingsLoaded && <div className="px-4 pb-4"><NotificationSettings onMessage={onMessage}/></div>}
    </details>
  </section>;
}
