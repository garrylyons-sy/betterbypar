import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/server/auth';
import { notificationAccess, saveNotificationPreferences } from '@/lib/server/notifications';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){const user=await currentUser();if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});const access=await notificationAccess(user.personId);if(!access.eligible)return NextResponse.json({error:'Notification access required.'},{status:403});return NextResponse.json({preferences:access.preferences});}
export async function PATCH(request:Request){try{const user=await currentUser();if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});if(!(await notificationAccess(user.personId)).eligible)return NextResponse.json({error:'Notification access required.'},{status:403});return NextResponse.json({preferences:await saveNotificationPreferences(user.personId,await request.json())});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not save preferences.'},{status:400});}}
