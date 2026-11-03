import {NextResponse} from 'next/server';
import {getProShop} from '@/lib/server/pro-shop';
import {AccessError} from '@/lib/server/golf-access';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){try{return NextResponse.json(await getProShop(request),{headers});}catch(e){return NextResponse.json({error:e instanceof AccessError?e.message:'The pro shop could not be loaded.'},{status:e instanceof AccessError?e.status:500,headers});}}
