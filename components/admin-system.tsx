'use client';
import { useEffect, useState } from 'react';
import { useSystemSettings } from '@/components/system-settings-provider';
import { defaultSystemSettings, systemSettingFields, validateSystemSettings, type SystemSettings } from '@/lib/system-settings.mjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export function AdminSystem({onMessage}: {onMessage: (message: string) => void}) {
  const {update} = useSystemSettings();
  const [saved, setSaved] = useState<SystemSettings | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  function populate(settings: SystemSettings) { setDraft(Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, String(value)]))); }
  useEffect(() => {
    let active = true;
    fetch('/api/admin/system-settings', {cache:'no-store', credentials:'same-origin'})
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load system settings.');
        if (active) { setSaved(data.settings); populate(data.settings); }
      }).catch(reason => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const changed = saved && systemSettingFields.some(field => draft[field.key] !== String(saved[field.key]));
  async function save() {
    setError('');
    setSaving(true);
    try {
      const settings = validateSystemSettings(Object.fromEntries(systemSettingFields.map(field => [field.key, typeof field.defaultValue === 'number' ? Number(draft[field.key]) : draft[field.key]])));
      const response = await fetch('/api/admin/system-settings', {method:'PATCH', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(settings)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save settings.');
      setSaved(data.settings); populate(data.settings); update(data.settings);
      onMessage('System settings saved. Reload other open devices to apply the changes there.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save settings.'); }
    finally { setSaving(false); }
  }
  return <div className="space-y-5"><Card><CardHeader><CardTitle>System</CardTitle><p className="text-sm text-muted-foreground">Control automatic refresh across the app. Shorter intervals use more requests. Changes apply on this device immediately and on other devices when reloaded.</p></CardHeader>
    <CardContent className="space-y-5">
      {loading && <p role="status">Loading system settings...</p>}
      {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
      {saved && <form onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-5">
        <fieldset disabled={saving} className="grid gap-5 sm:grid-cols-2">
          {systemSettingFields.map(field => <label key={field.key} className="grid content-start gap-1.5 text-sm font-bold">
            <span>{field.label}{typeof field.defaultValue === 'number' ? ' (seconds)' : ''}</span>
            <input type={typeof field.defaultValue === 'number' ? 'number' : 'time'} required min={field.min} max={field.max} step={typeof field.defaultValue === 'number' ? 1 : 60} value={draft[field.key] ?? ''} onChange={event => setDraft(current => ({...current, [field.key]:event.target.value}))} className="h-11 w-full rounded-lg border border-input bg-white px-3" />
            <span className="font-normal text-muted-foreground">{field.description} Default: {field.defaultValue}{typeof field.defaultValue === 'number' ? ' seconds' : ''}.</span>
          </label>)}
        </fieldset>
        <p className="text-sm text-muted-foreground">Completed matches stop polling. Background tabs pause polling. The match-night window applies to fixtures and lineups; live scoring uses its own intervals.</p>
        <div className="flex flex-wrap gap-3"><Button type="submit" disabled={saving || !changed}>{saving ? 'Saving...' : 'Save settings'}</Button><Button type="button" variant="outline" disabled={saving} onClick={() => populate({...defaultSystemSettings})}>Restore defaults</Button><Button type="button" variant="outline" disabled={saving || !changed} onClick={() => { populate(saved); setError(''); }}>Discard changes</Button></div>
      </form>}
    </CardContent></Card></div>;
}
