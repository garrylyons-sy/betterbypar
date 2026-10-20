'use client';
import {useEffect, useRef, useState} from 'react';
import {Button} from '@/components/ui/button';
import {notificationRoles} from '@/lib/notification-policy.mjs';

type Audience = {roles:string[]; clubId:string|null; teamId:string|null};
type Draft = {title:string; body:string; audience:Audience};
export type Counts = {matched:number; eligible:number; excluded:number; inbox:number; push:number; skipped:number};
type Preview = Counts & {previewToken:string; enabled:boolean; announcementsEnabled:boolean};
type Options = {clubs:{id:string; name:string}[]; teams:{id:string; clubId:string; name:string; league:string; season:string}[]; eligibleRoles:string[]; enabled:boolean; announcementsEnabled:boolean};
const endpoint = '/api/admin/notifications/announcements';
const emptyDraft = ():Draft => ({title:'', body:'', audience:{roles: [], clubId:null, teamId:null}});
const inputClass = 'w-full rounded-lg border bg-white px-3 py-2 text-sm';
export function DeliveryCounts({counts}:{counts:Counts}) {
  return <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
    <div><dt className="text-muted-foreground">Matched people</dt><dd className="font-bold">{counts.matched}</dd></div>
    <div><dt className="text-muted-foreground">Eligible people</dt><dd className="font-bold">{counts.eligible}</dd></div>
    <div><dt className="text-muted-foreground">Excluded by rollout</dt><dd className="font-bold">{counts.excluded}</dd></div>
    <div><dt className="text-muted-foreground">Inbox recipients</dt><dd className="font-bold">{counts.inbox}</dd></div>
    <div><dt className="text-muted-foreground">Phone push recipients</dt><dd className="font-bold">{counts.push}</dd></div>
    <div><dt className="text-muted-foreground">Opted out / no enabled channel</dt><dd className="font-bold">{counts.skipped}</dd></div>
  </dl>;
}
export function AdminNotificationComposer({onMessage,onSent}:{onMessage:(message:string)=>void;onSent?:()=>void}) {
  const [options,setOptions] = useState<Options|null>(null);
  const [draft,setDraft] = useState<Draft>(emptyDraft);
  const [preview,setPreview] = useState<Preview|null>(null);
  const [busy,setBusy] = useState(false);
  const [operation,setOperation] = useState<'preview'|'send'|null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  const busyRef = useRef(false);
  const requestId = useRef<string|null>(null);
  useEffect(()=>{
    let active = true;
    async function load() {
      try {
        const response = await fetch(endpoint,{cache:'no-store',credentials:'same-origin'});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load announcement audiences.');
        if (active) {setOptions(data);setError('');}
      } catch(reason) {if(active)setError(reason instanceof Error ? reason.message : 'Could not load announcement audiences.');}
      finally {if(active)setLoading(false);}
    }
    function settingsChanged() {setPreview(null);void load();}
    void load();
    window.addEventListener('interclub:notification-settings-changed',settingsChanged);
    return ()=>{active=false;window.removeEventListener('interclub:notification-settings-changed',settingsChanged);};
  },[]);
  function edit(next:Draft) {
    if (busyRef.current) return;
    setDraft(next);setPreview(null);requestId.current = null;setError('');
  }
  async function submit(action:'preview'|'send') {
    if (busyRef.current) return;
    if (action === 'send' && !preview) return;
    busyRef.current = true;setBusy(true);setOperation(action);setError('');
    try {
      const payload:Record<string,unknown> = {action,...draft};
      if (action === 'send' && preview) {
        requestId.current ??= crypto.randomUUID();
        Object.assign(payload,{requestId:requestId.current,previewToken: preview.previewToken});
      }
      const response = await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) {setPreview(null);requestId.current = null;}
        throw new Error(data.error || (action === 'send' ? 'Could not send announcement. Retry to safely check this send.' : 'Could not preview announcement.'));
      }
      if (action === 'preview') {
        setPreview(data.preview);
        setOptions(current=>current ? {...current,enabled:data.preview.enabled,announcementsEnabled:data.preview.announcementsEnabled} : current);
      } else {
        if (data.announcement) onSent?.();
        setPreview(null);requestId.current = null;setDraft(emptyDraft());
        onMessage(data.duplicate ? 'This announcement was already sent. Its original result is shown in sent history.' : 'Announcement sent. Delivery counts are shown in sent history.');
      }
    } catch(reason) {setError(reason instanceof Error ? reason.message : 'Could not complete announcement request.');}
    finally {busyRef.current = false;setBusy(false);setOperation(null);}
  }
  const teams = options?.teams.filter(team=>team.clubId === draft.audience.clubId) ?? [];
  const recipientCount = preview ? Math.max(0,preview.eligible-preview.skipped) : 0;
  const disabled = !options?.enabled || !options?.announcementsEnabled;
  return <section className="space-y-5 border-t pt-6" aria-labelledby="announcement-heading">
    <div><h3 id="announcement-heading" className="text-lg font-extrabold">Send an announcement</h3><p className="mt-1 text-sm text-muted-foreground">Send a plain text message to role groups, a club or a team. Multiple roles are combined; club and team filters narrow those people. Every person is counted once.</p></div>
    {loading && <p role="status">Loading announcement audiences...</p>}
    {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
    {options && <>
      <div className="rounded-lg bg-muted p-4 text-sm"><p className="font-bold">Current rollout: {options.eligibleRoles.join(', ') || 'No eligible roles'}.</p><p className="mt-1">The initial pilot includes League Chair only. People outside the configured rollout are excluded even when they match your audience.</p>{!options.enabled && <p className="mt-2 font-bold">Notifications are disabled. Enable them in notification settings before sending.</p>}{!options.announcementsEnabled && <p className="mt-2 font-bold">Announcements are disabled. Enable this category in notification settings before sending.</p>}</div>
      <form className="space-y-4" onSubmit={event=>{event.preventDefault();void submit('preview');}}>
        <fieldset disabled={busy} className="space-y-4">
          <fieldset className="space-y-2"><legend className="text-sm font-bold">Role groups</legend><p className="text-sm text-muted-foreground">No roles selected means all roles. Selected roles intersect with your club or team scope.</p><div className="grid gap-2 sm:grid-cols-3">{notificationRoles.map(role=><label key={role} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={draft.audience.roles.includes(role)} onChange={event=>edit({...draft,audience:{...draft.audience,roles:event.target.checked ? [...draft.audience.roles,role] : draft.audience.roles.filter(value=>value!==role)}})}/>{role}</label>)}</div></fieldset>
          <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-bold">Club<select className={inputClass} value={draft.audience.clubId ?? ''} onChange={event=>edit({...draft,audience:{...draft.audience,clubId:event.target.value || null,teamId:null}})}><option value="">All clubs</option>{options.clubs.map(club=><option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-bold">Team<select className={inputClass} disabled={!draft.audience.clubId || busy} value={draft.audience.teamId ?? ''} onChange={event=>edit({...draft,audience:{...draft.audience,teamId:event.target.value || null}})}><option value="">{draft.audience.clubId ? 'All teams in this club' : 'Select a club first'}</option>{teams.map(team=><option key={team.id} value={team.id}>{team.name} · {team.league} · {team.season}</option>)}</select></label></div>
          <label className="grid gap-2 text-sm font-bold">Title<input className={inputClass} required maxLength={120} value={draft.title} onChange={event=>edit({...draft,title:event.target.value})}/><span className="text-xs font-normal text-muted-foreground">{draft.title.length}/120 characters</span></label>
          <label className="grid gap-2 text-sm font-bold">Message<textarea className={`${inputClass} min-h-32`} required maxLength={2000} rows={5} value={draft.body} onChange={event=>edit({...draft,body:event.target.value})}/><span className="text-xs font-normal text-muted-foreground">{draft.body.length}/2000 characters</span></label>
          <Button type="submit" variant="outline" disabled={busy || !draft.title.trim() || !draft.body.trim()}>{operation==='preview' ? 'Checking recipients...' : 'Preview recipients'}</Button>
        </fieldset>
        {preview && <div className="space-y-4 rounded-lg border p-4" aria-live="polite"><h4 className="font-extrabold">Announcement preview</h4><div className="space-y-2 rounded-lg bg-muted p-3"><p className="whitespace-pre-wrap break-words font-bold">{draft.title}</p><p className="whitespace-pre-wrap break-words text-sm">{draft.body}</p></div><DeliveryCounts counts={preview}/><p className="text-xs text-muted-foreground">Phone push counts people, even if they have several devices. Delivery respects personal settings and quiet hours.</p>{recipientCount===0 && <p className="text-sm font-bold">No reachable recipients. Adjust your audience or notification settings.</p>}<Button type="button" disabled={busy || disabled || !preview.enabled || !preview.announcementsEnabled || recipientCount===0} onClick={()=>void submit('send')}>{operation==='send' ? 'Sending...' : <>Send to {recipientCount} recipient{recipientCount===1 ? '' : 's'}</>}</Button></div>}
      </form>

    </>}
  </section>;
}
