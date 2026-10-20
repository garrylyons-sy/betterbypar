import { NextResponse } from 'next/server';
import { loadSystemSettings } from '@/lib/server/system-settings';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Only the allowlisted, non-secret polling configuration is returned.
export async function GET() {
  try {
    return NextResponse.json({settings: await loadSystemSettings()}, {headers: {'Cache-Control': 'no-store'}});
  } catch {
    return NextResponse.json({error: 'System settings are unavailable.'}, {status: 503});
  }
}
