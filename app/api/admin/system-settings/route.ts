import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/server/auth';
import { isPlatformOperator } from '@/lib/server/maintenance';
import { loadSystemSettings, saveSystemSettings } from '@/lib/server/system-settings';
import { validateSystemSettings } from '@/lib/system-settings.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function authorize() {
  const user = await currentUser();
  if (!user) return {error: NextResponse.json({error:'Not signed in.'}, {status:401})};
  if (!await isPlatformOperator(user.personId)) return {error: NextResponse.json({error:'Platform administrator access required.'}, {status:403})};
  return {user};
}
export async function GET() {
  const access = await authorize();
  if (access.error) return access.error;
  return NextResponse.json({settings: await loadSystemSettings()}, {headers:{'Cache-Control':'no-store'}});
}
export async function PATCH(request: Request) {
  const access = await authorize();
  if (access.error) return access.error;
  let settings;
  try { settings = validateSystemSettings(await request.json()); }
  catch (error) { return NextResponse.json({error: error instanceof Error ? error.message : 'Invalid settings.'}, {status:400}); }
  try { return NextResponse.json({settings: await saveSystemSettings(settings, access.user!.personId)}); }
  catch { return NextResponse.json({error:'Could not save system settings. Check that the system_settings database migration has been applied.'}, {status:500}); }
}
