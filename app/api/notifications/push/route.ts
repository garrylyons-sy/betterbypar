import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/server/auth';
import { dbQuery } from '@/lib/server/db';
import { notificationAccess } from '@/lib/server/notifications';
import { pushReadiness, subscribeNotificationPush } from '@/lib/server/notification-push';

export const runtime='nodejs';
export const dynamic='force-dynamic';

async function access(requireEligible=true){
  const user=await currentUser();
  if(!user)return {error:NextResponse.json({error:'Sign in required.'},{status:401})};
  if(requireEligible && !(await notificationAccess(user.personId)).eligible)return {error:NextResponse.json({error:'Notifications are unavailable.'},{status:403})};
  return {user};
}
export async function GET(request:Request){
  const a=await access();if(a.error)return a.error;
  const endpoint=new URL(request.url).searchParams.get('endpoint');
  const result=await dbQuery('select id from public.notification_push_subscription where person_id=$1 and active=true and ($2::text is null or endpoint=$2) limit 1',[a.user!.personId,endpoint]);
  return NextResponse.json({...pushReadiness(),subscribed:!!result.rowCount});
}
export async function POST(request:Request){
  const a=await access();if(a.error)return a.error;
  if(!pushReadiness().ready)return NextResponse.json({error:'Push notifications are not configured.'},{status:503});
  let body;try{body=await request.json();}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400});}
  try{
    if(!(await subscribeNotificationPush(a.user!.personId,body?.subscription)))return NextResponse.json({error:'This device is registered to another account. Unsubscribe there first.'},{status:409});
    return NextResponse.json({subscribed:true});
  }catch(error){
    if(error instanceof Error && /Invalid push|Unsupported push/.test(error.message))return NextResponse.json({error:error.message},{status:400});
    throw error;
  }
}
export async function DELETE(request:Request){
  const a=await access(false);if(a.error)return a.error;
  let body;try{body=await request.json();}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400});}
  if(typeof body?.endpoint!=='string' || body.endpoint.length>2048)return NextResponse.json({error:'Endpoint required.'},{status:400});
  await dbQuery('update public.notification_push_subscription set active=false,updated_at=now() where person_id=$1 and endpoint=$2',[a.user!.personId,body.endpoint]);
  return NextResponse.json({subscribed:false});
}
