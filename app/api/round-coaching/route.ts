import {NextResponse} from 'next/server';
import {getRoundCoaching,postRoundComment} from '@/lib/server/round-coaching';
import {AccessError} from '@/lib/server/golf-access';
import {scheduleNotificationPush} from '@/lib/server/notification-dispatch';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const failure=(error:unknown)=>NextResponse.json({error:error instanceof AccessError?error.message:'Your round discussion request could not be completed. Please try again.'},{status:error instanceof AccessError?error.status:500,headers});
export async function GET(request:Request){try{return NextResponse.json(await getRoundCoaching(request),{headers});}catch(error){return failure(error);}}
export async function POST(request:Request){try{
 if(!request.headers.get('content-type')?.includes('application/json'))throw new AccessError('Send JSON round discussion data.',400);
 const reader=request.body?.getReader();if(!reader)throw new AccessError('Round discussion data is required.',400);
 let size=0;const chunks:Uint8Array[]=[];try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>50000)throw new AccessError('Round discussion data is too large.',413);chunks.push(part.value);}}finally{await reader.cancel();}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AccessError('Invalid round discussion data.',400);}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new AccessError('Invalid round discussion data.',400);
 const result=await postRoundComment(request,body);scheduleNotificationPush();return NextResponse.json(result,{headers});
 }catch(error){return failure(error);}}
