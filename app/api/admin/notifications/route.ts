import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/server/auth';
import {isPlatformOperator} from '@/lib/server/maintenance';
import {loadNotificationConfig, saveNotificationConfig} from '@/lib/server/notifications';
import {pushReadiness} from '@/lib/server/notification-push';
import {validateNotificationConfig} from '@/lib/notification-policy.mjs';
import {dbQuery} from '@/lib/server/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function authorize() {
  const user = await currentUser();
  if (!user) return {error: NextResponse.json({error:'Not signed in.'}, {status: 401})};
  if (!await isPlatformOperator(user.personId)) return {error: NextResponse.json({error:'Platform administrator access required.'}, {status: 403})};
  return {user};
}
async function deliverySummary() {
  try {
    const result = await dbQuery<{status:string; count:string}>(`select status, count(*)::text from public.notification_push_delivery group by status`);
    return Object.fromEntries(result.rows.map(row => [row.status, Number(row.count)]));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '42P01') return null;
    throw error;
  }
}
export async function GET() {
  try {
    const access = await authorize();
    if (access.error) return access.error;
    return NextResponse.json({config:await loadNotificationConfig(),push:pushReadiness(),delivery:await deliverySummary()}, {headers:{'Cache-Control':'no-store'}});
  } catch {
    return NextResponse.json({error:'Notification settings could not be loaded.'}, {status:500});
  }
}
export async function PATCH(request:Request) {
  try {
    const access = await authorize();
    if (access.error) return access.error;
    let config;
    try { config = validateNotificationConfig(await request.json()); }
    catch (error) { return NextResponse.json({error:error instanceof Error ? error.message : 'Invalid notification settings.'}, {status:400}); }
    return NextResponse.json({config:await saveNotificationConfig(config,access.user!.personId),push:pushReadiness(),delivery:await deliverySummary()});
  } catch {
    return NextResponse.json({error:'Could not save notification settings. Check the notifications database migration has been applied.'}, {status:500});
  }
}
