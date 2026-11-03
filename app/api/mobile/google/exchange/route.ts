import {readMobileAuthBody} from '@/lib/server/mobile-auth-request';
import {NextResponse} from 'next/server';
import {exchangeMobileGoogle} from '@/lib/server/mobile-google';
import {loadMaintenanceMode} from '@/lib/server/maintenance';
import {recordLogin} from '@/lib/server/auth';
export const runtime='nodejs';
export async function POST(request:Request){const headers={'Cache-Control':'no-store'};try{
 if((await loadMaintenanceMode()).enabled)return NextResponse.json({error:'Better By Par is down for maintenance.'},{status:503,headers});
 const body=await readMobileAuthBody(request),result=await exchangeMobileGoogle(body.attempt,body.code,body.verifier);await recordLogin(result.user,'google',request.headers.get('user-agent')??'Better By Par native').catch(()=>{});return NextResponse.json(result,{headers});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Google sign-in failed.'},{status:401,headers});}}
