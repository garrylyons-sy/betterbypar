'use client';
import {useEffect, useState} from 'react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {defaultNotificationConfig, validateNotificationConfig, notificationRoles} from '@/lib/notification-policy.mjs';

type Config = typeof defaultNotificationConfig;
const roles = notificationRoles;
const categories = [
  {key:'fixture_change',label:'Fixture changes',description:'Date changes, postponements and cancellations for affected teams, plus League Chair oversight.'},
  {key:'match_reminder',label:'Match reminders',description:'Upcoming matches for affected players and managers, plus League Chairs.'},
  {key:'lineup_reminder',label:'Lineup reminders',description:'Missing lineups for managers and League Chair oversight.'},
  {key:'ladder_challenge',label:'Ladder challenges',description:'New challenges and approaching deadlines for the players involved.'}
] as const;
const reminderFields = [
  {key:'matchReminderHours',label:'Match reminder — hours before match'},
  {key:'lineupReminderHours',label:'Missing lineup reminder — hours before match'},
  {key:'ladderReminderHours',label:'Ladder deadline reminder — hours before deadline'}
] as const;
export function AdminNotifications({onMessage}:{onMessage:(message:string)=>void}) {
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
  return <Card><CardHeader><CardTitle>Notifications</CardTitle><p className="text-sm text-muted-foreground">Choose who can use the notification inbox and which events create alerts. The initial pilot includes League Chairs only.</p></CardHeader>
    <CardContent className="space-y-5">
      {loading && <p role="status">Loading notification settings...</p>}
      {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
      {saved && <form className="space-y-6" onSubmit={event=>{event.preventDefault();void save();}}>
        <fieldset disabled={saving} className="space-y-6">
          <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={draft.enabled} onChange={event=>setDraft(current=>({...current,enabled:event.target.checked}))}/>Enable notifications</label>
          <div className="space-y-3"><h3 className="font-extrabold">Who gets a notification inbox?</h3><p className="text-sm text-muted-foreground">A person needs at least one of the selected active roles. Removing their role blocks inbox access and stops future push delivery. No roles selected means nobody has access.</p>
            <div className="grid gap-3 sm:grid-cols-3">{roles.map(role=><label key={role} className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm font-bold"><input type="checkbox" checked={draft.eligibleRoles.includes(role)} onChange={event=>setDraft(current=>({...current,eligibleRoles:event.target.checked ? [...current.eligibleRoles,role] : current.eligibleRoles.filter(value=>value!==role)}))}/>{role}</label>)}</div>
          </div>
          <div className="space-y-3"><h3 className="font-extrabold">Automatic notification types</h3><div className="grid gap-3 sm:grid-cols-2">{categories.map(category=><label key={category.key} className="flex items-start gap-3 rounded-lg border p-3"><input className="mt-1" type="checkbox" checked={draft.enabledTypes.includes(category.key)} onChange={event=>setDraft(current=>({...current,enabledTypes:event.target.checked ? [...current.enabledTypes,category.key] : current.enabledTypes.filter(value=>value!==category.key)}))}/><span><span className="block text-sm font-bold">{category.label}</span><span className="text-sm text-muted-foreground">{category.description}</span></span></label>)}</div></div>
          <div className="grid gap-4 sm:grid-cols-3">{reminderFields.map(field=><label key={field.key} className="grid gap-2 text-sm font-bold"><span>{field.label}</span><input required type="number" min={1} max={168} step={1} value={Number.isFinite(draft[field.key]) ? draft[field.key] : ''} onChange={event=>setDraft(current=>({...current,[field.key]:event.target.value==='' ? NaN : Number(event.target.value)}))} className="h-11 w-full rounded-lg border bg-white px-3"/></label>)}</div>
          <p className="text-sm text-muted-foreground">Fixtures stored with a date only use a 19:30 start in Ireland for reminders. Reminders are processed approximately hourly when the scheduled worker is deployed. Fixture and challenge changes queue phone delivery immediately.</p>
          <div className="space-y-3"><h3 className="font-extrabold">Quiet hours for phone push</h3><p className="text-sm text-muted-foreground">Europe/Dublin time. Inbox notifications still appear during quiet hours; phone alerts wait until quiet hours end. Use the same start and end time to turn quiet hours off.</p><div className="grid gap-4 sm:grid-cols-2">{(['quietStart','quietEnd'] as const).map(key=><label key={key} className="grid gap-2 text-sm font-bold">{key==='quietStart' ? 'Quiet hours start' : 'Quiet hours end'}<input required type="time" value={draft[key]} onChange={event=>setDraft(current=>({...current,[key]:event.target.value}))} className="h-11 rounded-lg border bg-white px-3"/></label>)}</div></div>
        </fieldset>
        <div className="rounded-lg bg-muted p-4"><p className="text-sm font-bold">Phone push: {ready ? 'Configured' : 'Not configured yet'}</p><p className="mt-1 text-sm text-muted-foreground">{ready ? 'People in the selected audience can enable notifications on each device.' : 'The inbox works without push. Phone delivery needs VAPID keys configured on the server.'}</p>{delivery && <p className="mt-2 text-xs text-muted-foreground">Push deliveries: {(delivery.Pending ?? 0)+(delivery.Sending ?? 0)} pending · {delivery.Sent ?? 0} sent · {delivery.Failed ?? 0} failed · {delivery.Skipped ?? 0} skipped</p>}</div>
        <div className="flex flex-wrap gap-3"><Button type="submit" disabled={saving || !changed}>{saving ? 'Saving...' : 'Save notification settings'}</Button><Button type="button" variant="outline" disabled={saving} onClick={()=>setDraft({...defaultNotificationConfig})}>Restore notification defaults</Button><Button type="button" variant="outline" disabled={saving || !changed} onClick={()=>{setDraft(saved);setError('');}}>Discard changes</Button></div>
      </form>}
    </CardContent></Card>;
}
