import { dbQuery } from '@/lib/server/db';
import { defaultSystemSettings, normalizeSystemSettings, validateSystemSettings } from '@/lib/system-settings.mjs';
export async function loadSystemSettings() {
  try {
    const result = await dbQuery<{settings: unknown}>('select settings from public.system_settings where singleton = true');
    return normalizeSystemSettings(result.rows[0]?.settings);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '42P01') return {...defaultSystemSettings};
    throw error;
  }
}
export async function saveSystemSettings(input: unknown, personId: string) {
  const settings = validateSystemSettings(input);
  await dbQuery(`insert into public.system_settings (singleton, settings, updated_by, updated_at)
    values (true, $1::jsonb, $2::uuid, now()) on conflict (singleton) do update
    set settings = excluded.settings, updated_by = excluded.updated_by, updated_at = excluded.updated_at`, [JSON.stringify(settings), personId]);
  return settings;
}
