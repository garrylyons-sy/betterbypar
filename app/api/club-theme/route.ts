import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/server/auth';
import {dbQuery} from '@/lib/server/db';
export const dynamic='force-dynamic';
export async function GET(){
 const user=await currentUser();
 if(!user)return NextResponse.json({clubs:[]},{status:401,headers:{'Cache-Control':'no-store'}});
 try{
  const result=await dbQuery(`select c.id,c.name,c.primary_color as "primaryColor",c.accent_color as "accentColor" from club c where c.active and (
   exists(select 1 from club_membership where club_id=c.id and person_id=$1 and active)
   or exists(select 1 from club_admin where club_id=c.id and person_id=$1 and active)
   or exists(select 1 from app_operator where person_id=$1 and active)
  ) order by c.name`,[user.personId]);
  return NextResponse.json({clubs:result.rows},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Club colours are unavailable.'},{status:500});}
}
