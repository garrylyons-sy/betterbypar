import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/server/auth';
import {dbQuery} from '@/lib/server/db';
export const dynamic='force-dynamic';
export async function GET(){
 const user=await currentUser();
 if(!user)return NextResponse.json({clubs:[]},{status:401,headers:{'Cache-Control':'no-store'}});
 try{
  const result=await dbQuery(`select c.id,c.name,c.primary_color as "primaryColor",c.accent_color as "accentColor",array(select case when cm.role='Club Member' and exists(select 1 from person home where home.id=cm.person_id and home.is_golf_player and home.player_club_id is not null and home.player_club_id<>c.id) then 'Club Admin' else cm.role end from club_membership cm where cm.club_id=c.id and cm.person_id=$1 and cm.active and (cm.role<>'Club Member' or cm.is_club_admin or exists(select 1 from club_admin ca where ca.person_id=cm.person_id and ca.club_id=c.id and ca.active) or not exists(select 1 from person home where home.id=cm.person_id and home.is_golf_player and home.player_club_id is not null and home.player_club_id<>c.id))) as roles from club c where c.active and (
   exists(select 1 from club_membership where club_id=c.id and person_id=$1 and active)
   or exists(select 1 from club_admin where club_id=c.id and person_id=$1 and active)
   or exists(select 1 from app_operator where person_id=$1 and active)
  ) order by c.name`,[user.personId]);
  return NextResponse.json({clubs:user.actingAs?result.rows.filter(c=>c.id===user.actingAs!.clubId).map(c=>({...c,roles:[user.actingAs!.role]})):result.rows},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Club colours are unavailable.'},{status:500});}
}
