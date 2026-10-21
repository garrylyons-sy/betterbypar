import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/server/auth';
import {isPlatformOperator} from '@/lib/server/maintenance';
import {dbQuery} from '@/lib/server/db';
import {notificationAccess} from '@/lib/server/notifications';
import {pushReadiness} from '@/lib/server/notification-push';
import {normalizeNotificationPreferences} from '@/lib/notification-policy.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});
  if(!await isPlatformOperator(user.personId))return NextResponse.json({error:'Platform administrator access required.'},{status:403});
  const personId=new URL(request.url).searchParams.get('personId')??'';
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(personId))return NextResponse.json({error:'Choose a valid person.'},{status:400});
  try{
    const person=await dbQuery(`select p.active,np.preferences,
      exists(select 1 from public.user_account ua where ua.person_id=p.id and ua.active) as "activeAccount",
      (select count(*)::int from public.notification_push_subscription s where s.person_id=p.id and s.active) as devices
      from public.person p left join public.notification_preference np on np.person_id=p.id where p.id=$1`,[personId]);
    if(!person.rows[0])return NextResponse.json({error:'Person not found.'},{status:404});
    const row=person.rows[0],access=await notificationAccess(personId);
    return NextResponse.json({eligible:access.eligible,enabled:access.config.enabled,activeAccount:Boolean(row.active&&row.activeAccount),preferences:normalizeNotificationPreferences(row.preferences),enabledTypes:access.config.enabledTypes,devices:row.devices,pushReady:pushReadiness().ready},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Could not load notification settings.'},{status:500});}
}
