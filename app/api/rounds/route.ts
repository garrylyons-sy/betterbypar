import {NextResponse} from 'next/server';
import {AccessError} from '@/lib/server/golf-access';
import {getRoundJournal,saveRoundJournal} from '@/lib/server/round-journal';
export const dynamic='force-dynamic';export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
const failure=(error:unknown)=>NextResponse.json({error:error instanceof AccessError?error.message:error instanceof Error&&/Golf Ireland|AI coaching|valid feedback|Choose a recent/.test(error.message)?error.message:'The round could not be processed. Please try again.'},{status:error instanceof AccessError?error.status:503,headers});
export async function GET(request:Request){try{return NextResponse.json(await getRoundJournal(request),{headers});}catch(error){return failure(error);}}
export async function POST(request:Request){try{
 if(!request.headers.get('content-type')?.includes('application/json'))throw new AccessError('Send JSON round data.',400);
 const reader=request.body?.getReader();if(!reader)throw new AccessError('Round data required.',400);
 let size=0;const chunks:Uint8Array[]=[];try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>400000)throw new AccessError('Round data is too large.',413);chunks.push(part.value);}}finally{await reader.cancel();}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AccessError('Invalid round data.',400);}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new AccessError('Invalid round data.',400);
 return NextResponse.json(await saveRoundJournal(request,body),{headers});
 }catch(error){return failure(error);}}
