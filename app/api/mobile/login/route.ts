import {NextResponse} from 'next/server';
import {accountByLoginIdentifier,verifyPassword,recordLogin} from '@/lib/server/auth';
import {createMobileSession,reserveMobileLogin} from '@/lib/server/mobile-auth';
import {loadMaintenanceMode} from '@/lib/server/maintenance';
export const runtime='nodejs';
export async function POST(request:Request){const headers={'Cache-Control':'no-store'};try{
 if(process.env.NODE_ENV==='production'&&(request.headers.get('x-forwarded-proto')??new URL(request.url).protocol.replace(':',''))!=='https')return NextResponse.json({error:'Secure HTTPS sign-in is required.'},{status:400,headers});
 if(!request.headers.get('content-type')?.includes('application/json'))return NextResponse.json({error:'Send JSON sign-in details.'},{status:400,headers});
 const reader=request.body?.getReader();let size=0;const chunks:Uint8Array[]=[];if(!reader)return NextResponse.json({error:'Sign-in details required.'},{status:400,headers});try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>4096)return NextResponse.json({error:'Sign-in request too large.'},{status:413,headers});chunks.push(p.value);}}finally{await reader.cancel();}
 let b;try{b=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return NextResponse.json({error:'Invalid sign-in details.'},{status:400,headers});}
 if(!b||typeof b.identifier!=='string'||typeof b.password!=='string'||!b.identifier.trim()||!b.password||b.identifier.length>254||b.password.length>512)return NextResponse.json({error:'Enter your email/user ID and password.'},{status:400,headers});
 await reserveMobileLogin(b.identifier);if((await loadMaintenanceMode()).enabled)return NextResponse.json({error:'Better By Par is down for maintenance.'},{status:503,headers});
 const account=await accountByLoginIdentifier(b.identifier.trim());if(!account||!verifyPassword(b.password,account.password_hash))return NextResponse.json({error:'Invalid login details.'},{status:401,headers});
 const user={accountId:account.id,personId:account.person_id,username:account.username,email:account.email??'',name:`${account.first_name} ${account.last_name}`.trim(),profileImage:account.profile_image??''};
 await recordLogin(user,'password',request.headers.get('user-agent')??'Better By Par native');return NextResponse.json({...await createMobileSession(account.id,account.password_hash),user},{headers});
 }catch(e){const code=(e as {status?:number}).status,status=code===429||code===401?code:500;return NextResponse.json({error:(status===429||status===401)?(e as Error).message:'Mobile sign-in unavailable. Please try again.'},{status,headers});}}
