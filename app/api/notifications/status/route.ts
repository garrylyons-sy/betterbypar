import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/server/auth';
import {notificationAccess} from '@/lib/server/notifications';
import {pushReadiness} from '@/lib/server/notification-push';
import {notificationEmailReady} from '@/lib/server/notification-email';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){const user=await currentUser();if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});if(!(await notificationAccess(user.personId)).eligible)return NextResponse.json({error:'Notification access required.'},{status:403});return NextResponse.json({webPushReady:pushReadiness().ready,emailReady:notificationEmailReady(),nativePushReady:false},{headers:{'Cache-Control':'no-store'}});}
