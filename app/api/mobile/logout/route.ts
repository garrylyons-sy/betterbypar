import {NextResponse} from 'next/server';import {mobileToken,revokeMobileSession} from '@/lib/server/mobile-auth';
export const runtime='nodejs';
export async function POST(request:Request){const header=request.headers.get('authorization'),headers={'Cache-Control':'no-store'};if(!mobileToken(header))return NextResponse.json({error:'Mobile session required.'},{status:401,headers});try{await revokeMobileSession(header);return NextResponse.json({ok:true},{headers});}catch{return NextResponse.json({error:'Could not revoke your session. Try again.'},{status:503,headers});}}
