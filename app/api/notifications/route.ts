import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/server/auth';
import { dismissNotification, loadNotificationInbox, markNotificationsRead, notificationAccess } from '@/lib/server/notifications';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{const user=await currentUser();if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});return NextResponse.json(await loadNotificationInbox(user.personId),{headers:{'Cache-Control':'no-store'}});}
 catch(error){console.error('notification-inbox',error);return NextResponse.json({error:'Could not load notifications.'},{status:500});}
}
export async function PATCH(request:Request){
 try{const user=await currentUser();if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});if(!(await notificationAccess(user.personId)).eligible)return NextResponse.json({error:'Notification access required.'},{status:403});
 const body=await request.json();if(body.all!==true&&(typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)))return NextResponse.json({error:'Choose a notification or mark all read.'},{status:400});
 await markNotificationsRead(user.personId,body.all===true?undefined:body.id);return NextResponse.json({ok:true});}
 catch{return NextResponse.json({error:'Could not update notifications.'},{status:400});}
}

export async function DELETE(request:Request){
 try{
 const user=await currentUser();if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});
 if(!(await notificationAccess(user.personId)).eligible)return NextResponse.json({error:'Notification access required.'},{status:403});
 const body=await request.json();
 if(typeof body?.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id))return NextResponse.json({error:'Choose a notification to delete.'},{status:400});
 await dismissNotification(user.personId,body.id);return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Could not delete notification.'},{status:400});}
}
