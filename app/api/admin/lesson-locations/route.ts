import {NextResponse} from 'next/server';
import {dbQuery,withTransaction} from '@/lib/server/db';
import {golfAccess,golfError,requireClubAdmin,golfAudit} from '@/lib/server/golf-access';
export const runtime='nodejs';
export async function GET(request:Request){try{
 const a=await golfAccess(request),clubId=new URL(request.url).searchParams.get('clubId')??'';requireClubAdmin(a,clubId);
 const locations=await dbQuery('select id,name from lesson_location where club_id=$1 and active order by sort_order,name',[clubId]);
 return NextResponse.json({locations:locations.rows},{headers:{'Cache-Control':'no-store'}});
}catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}}
export async function PATCH(request:Request){try{
 const a=await golfAccess(request),b=await request.json(),clubId=String(b.clubId??'');requireClubAdmin(a,clubId);
 if(!Array.isArray(b.names)||b.names.length<1||b.names.length>20||b.names.some((n:unknown)=>typeof n!=='string'||!n.trim()||n.trim().length>80))throw new Error('Enter between 1 and 20 location names, up to 80 characters each.');
 const names:string[]=b.names.map((n:string)=>n.trim());if(new Set(names.map(n=>n.toLowerCase())).size!==names.length)throw new Error('Use a different name for each location.');
 await withTransaction(async client=>{
  if(!(await client.query('select id from club where id=$1 and active for update',[clubId])).rowCount)throw new Error('Club not found.');
  await client.query('update lesson_location set active=false where club_id=$1',[clubId]);
  for(const [order,name] of names.entries())await client.query('insert into lesson_location(club_id,name,sort_order) values($1,$2,$3) on conflict(club_id,lower(name)) do update set active=true,name=excluded.name,sort_order=excluded.sort_order',[clubId,name,order]);
  await golfAudit(client,a.user.personId,'Lesson locations updated',{clubId,names});
 });return NextResponse.json({ok:true});
}catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}}
