import {NextResponse} from 'next/server';
import {getPractice,savePractice} from '@/lib/server/practice';
import {AccessError} from '@/lib/server/golf-access';
import {scheduleNotificationPush} from '@/lib/server/notification-dispatch';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const failure=(error:unknown)=>NextResponse.json({error:error instanceof AccessError?error.message:'Your practice request could not be completed. Please try again.'},{status:error instanceof AccessError?error.status:500,headers});
export async function GET(request:Request){try{return NextResponse.json(await getPractice(request),{headers});}catch(error){return failure(error);}}
export async function POST(request:Request){try{
 if(!request.headers.get('content-type')?.includes('application/json'))throw new AccessError('Send JSON practice data.',400);
 const reader=request.body?.getReader();if(!reader)throw new AccessError('Practice data is required.',400);
 let size=0;const chunks:Uint8Array[]=[];try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>50000)throw new AccessError('Practice data is too large.',413);chunks.push(part.value);}}finally{await reader.cancel();}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AccessError('Invalid practice data.',400);}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new AccessError('Invalid practice data.',400);
 const result=await savePractice(request,body);if(['assign','log','check','attest'].includes(body.action))scheduleNotificationPush();return NextResponse.json(result,{headers});
 }catch(error){return failure(error);}}
