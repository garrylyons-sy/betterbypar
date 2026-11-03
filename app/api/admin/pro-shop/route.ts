import {NextResponse} from 'next/server';
import {getShopAdmin,mutateShop,shopBody} from '@/lib/server/pro-shop';
import {AccessError} from '@/lib/server/golf-access';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const failure=(e:unknown)=>NextResponse.json({error:e instanceof AccessError?e.message:'The pro shop could not be updated.'},{status:e instanceof AccessError?e.status:500,headers});
export async function GET(request:Request){try{return NextResponse.json(await getShopAdmin(request),{headers});}catch(e){return failure(e);}}
export async function POST(request:Request){try{return NextResponse.json(await mutateShop(request,await shopBody(request)),{headers});}catch(e){return failure(e);}}
