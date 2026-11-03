import {NextResponse} from 'next/server';
import {checkoutShop,shopBody} from '@/lib/server/pro-shop';
import {AccessError} from '@/lib/server/golf-access';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request){try{return NextResponse.json(await checkoutShop(request,await shopBody(request)),{headers});}catch(e){return NextResponse.json({error:e instanceof AccessError?e.message:'Checkout could not be started. Please try again.'},{status:e instanceof AccessError?e.status:500,headers});}}
