import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/server/auth';
import {getPool,withTransaction} from '@/lib/server/db';
import {normalizeClubBrandingInput} from '@/lib/server/admin-clubs';
import {listClubBranding,saveClubBranding} from '@/lib/server/club-branding-store';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET() {
  try {
    const user=await currentUser();
    if(!user) return NextResponse.json({authenticated:false,administrator:false,error:'Sign in to manage your club.'},{status:401});
    const clubs=await listClubBranding(getPool(),user.personId);
    if(!clubs.length) return NextResponse.json({authenticated:true,administrator:false,error:'An active club administrator appointment is required.'},{status:403});
    return NextResponse.json({authenticated:true,administrator:true,adminMode:'club',clubs,user:{name:user.name}},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:'Club branding is unavailable.'},{status:500});
  }
}

export async function PATCH(request:Request) {
  try {
    const user=await currentUser();
    if(!user) return NextResponse.json({authenticated:false,administrator:false,error:'Sign in to manage your club.'},{status:401});
    const body=await request.json();
    const id=String(body.id??'').trim();
    if(!id) throw new Error('Select a club.');
    const branding=normalizeClubBrandingInput(body);
    const club=await withTransaction(client=>saveClubBranding(client,user.personId,id,branding));
    return NextResponse.json({club});
  } catch(error) {
    const status=(error as {status?:number})?.status===403?403:400;
    return NextResponse.json({error:error instanceof Error?error.message:'Club branding could not be saved.'},{status});
  }
}
