import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/server/db';
import { golfAccess, golfError, AccessError } from '@/lib/server/golf-access';
export const runtime='nodejs';
export async function GET(request:Request) {
 try {
  const access=await golfAccess(request);
  if (!access.platform && !access.adminClubIds.length) throw new AccessError('Administrator access required.');
  const people=await dbQuery(`select p.id,concat_ws(' ',p.first_name,p.last_name) as name,p.email from public.person p where p.active
    and ($1::boolean or exists(select 1 from public.club_membership cm where cm.person_id=p.id and cm.active and cm.club_id=any($2::uuid[]))) order by p.first_name,p.last_name`,[access.platform,access.adminClubIds]);
  if (new URL(request.url).searchParams.get('memberships') === 'true') {
    const members=await dbQuery(`select distinct p.id,concat_ws(' ',p.first_name,p.last_name) as name,cm.club_id,public.is_golf_player(p.id,cm.club_id) as is_player from public.person p join public.club_membership cm on cm.person_id=p.id and cm.active where p.active and ($1::boolean or cm.club_id=any($2::uuid[])) order by name`,[access.platform,access.adminClubIds]);
    return NextResponse.json({people:members.rows});
  }
  return NextResponse.json({people:people.rows});
 } catch(error) {const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
export async function POST(request:Request) {
 try {
  const access=await golfAccess(request);
  if (!access.platform) throw new AccessError('Platform administrator access required.');
  const body=await request.json();
  const firstName=String(body.firstName??'').trim(),lastName=String(body.lastName??'').trim(),email=String(body.email??'').trim().toLowerCase();
  if(!firstName||!lastName) throw new Error('First and last name are required.');
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email or leave it blank.');
  const person=await dbQuery(`insert into public.person(first_name,last_name,email) values($1,$2,$3) returning id,concat_ws(' ',first_name,last_name) as name,email`,[firstName,lastName,email||null]);
  return NextResponse.json({person:person.rows[0]},{status:201});
 } catch(error) {const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
