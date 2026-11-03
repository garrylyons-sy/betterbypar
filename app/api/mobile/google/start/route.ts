import {readMobileAuthBody} from '@/lib/server/mobile-auth-request';
import {NextResponse} from 'next/server';
import {beginMobileGoogle} from '@/lib/server/mobile-google';
import {reserveMobileLogin} from '@/lib/server/mobile-auth';
import {loadMaintenanceMode} from '@/lib/server/maintenance';
export const runtime='nodejs';
export async function POST(request:Request){const headers={'Cache-Control':'no-store'};try{
 if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET)return NextResponse.json({error:'Google sign-in is not configured yet. Please use your email and password.'},{status:503,headers});
 if((await loadMaintenanceMode()).enabled)return NextResponse.json({error:'Better By Par is down for maintenance.'},{status:503,headers});
 await reserveMobileLogin('google:'+String(request.headers.get('x-forwarded-for')??'local').split(',')[0]);
 const body=await readMobileAuthBody(request);const attempt=await beginMobileGoogle(body.challenge),url=new URL('/auth/google',request.url);url.host=request.headers.get('host')??url.host;url.searchParams.set('next',`/auth/mobile-google?attempt=${attempt}`);return NextResponse.json({attempt,url:url.toString()},{headers});
 }catch{return NextResponse.json({error:'Could not start Google sign-in. Try again shortly.'},{status:400,headers});}}
