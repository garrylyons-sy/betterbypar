import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/server/auth';
import {loadSponsorAdverts} from '@/lib/server/adverts';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
 try{const user=await currentUser();if(!user)return NextResponse.json({error:'Sign in to continue.'},{status:401,headers});
  return NextResponse.json({adverts:await loadSponsorAdverts(user.personId)},{headers});
 }catch{return NextResponse.json({error:'Could not load adverts.'},{status:503,headers});}
}
