'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { defaultSystemSettings, normalizeSystemSettings, type SystemSettings } from '@/lib/system-settings.mjs';
const Context = createContext({settings: {...defaultSystemSettings}, update: (_settings: SystemSettings) => {}});
export function SystemSettingsProvider({children}: {children: React.ReactNode}) {
  const [settings, setSettings] = useState<SystemSettings>({...defaultSystemSettings});
  const edited = useRef(false);
  useEffect(() => {
    let active = true;
    fetch('/api/system-settings', {cache:'no-store', credentials:'same-origin'})
      .then(async response => { if (response.ok) { const data = await response.json(); if (active && !edited.current) setSettings(normalizeSystemSettings(data.settings)); } })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return <Context.Provider value={{settings, update: next => { edited.current = true; setSettings(next); }}}>{children}</Context.Provider>;
}
export function useSystemSettings() { return useContext(Context); }
