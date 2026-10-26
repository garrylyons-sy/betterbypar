import {NextResponse} from 'next/server';
import {dbQuery,withTransaction} from '@/lib/server/db';
import {golfAccess,golfError,AccessError,golfAudit} from '@/lib/server/golf-access';
import {materializeLessons,requireDiaryOwner,requireActiveCoach} from '@/lib/server/lesson-diary';
import {weekStart,addDays,dublinDate,normalizeRanges} from '@/lib/lesson-diary.mjs';
export const runtime='nodejs';
export async function GET(request:Request){
 try{
  const a=await golfAccess(request),params=new URL(request.url).searchParams;
  const scope=[...new Set([...a.adminClubIds,...a.assignments.filter(r=>['Golf Professional','Assistant Professional'].includes(r.role)).map(r=>r.clubId)])];
  if(!a.platform&&!scope.length)throw new AccessError('Professional or administrator access required.');
  const clubs=(await dbQuery(`select id,name from club where active and ($1::boolean or id=any($2::uuid[])) order by name`,[a.platform,scope])).rows;
  const professionals=(await dbQuery(`select distinct p.id,concat_ws(' ',p.first_name,p.last_name) as name,cm.club_id,cm.role from club_membership cm join person p on p.id=cm.person_id and p.active join club c on c.id=cm.club_id and c.active where cm.active and cm.role in ('Golf Professional','Assistant Professional') and ($1::boolean or cm.club_id=any($2::uuid[])) and ($1::boolean or cm.club_id=any($3::uuid[]) or p.id=$4) order by name`,[a.platform,scope,a.adminClubIds,a.user.personId])).rows;
  const clubId=params.get('clubId')||clubs[0]?.id;
  const professionalId=params.get('professionalId')||professionals.find(p=>p.club_id===clubId&&p.id===a.user.personId)?.id||professionals.find(p=>p.club_id===clubId)?.id;
  const week=weekStart(params.get('week')||dublinDate());
  if(week>addDays(weekStart(),49)||week<addDays(weekStart(),-365))throw new Error('Choose a week within the diary range.');
  if(!clubId||!professionalId)return NextResponse.json({clubs,professionals,actorId:a.user.personId,week,defaultRanges:[],weekRanges:[],hasOverride:false,slots:[]});
  requireDiaryOwner(a,clubId,professionalId);
  await materializeLessons([clubId],a.user.personId);
  const [defaults,override,slots]=await Promise.all([
   dbQuery('select ranges from lesson_default_week where club_id=$1 and professional_person_id=$2',[clubId,professionalId]),
   dbQuery('select ranges from lesson_week_override where club_id=$1 and professional_person_id=$2 and week_start=$3',[clubId,professionalId,week]),
   dbQuery(`select s.*,concat_ws(' ',pro.first_name,pro.last_name) as professional_name,
    (select role from club_membership where club_id=s.club_id and person_id=s.professional_person_id and active and role in ('Golf Professional','Assistant Professional') order by role desc limit 1) as professional_role,
    g.name as group_name,g.mode as group_mode,(select count(*)::int from lesson_booking where slot_id=s.id and status='Booked') as booked_count,b.id as booking_id,concat_ws(' ',p.first_name,p.last_name) as player_name,b.goals,b.feedback,b.drills,
    concat_ws(' ',actor.first_name,actor.last_name) as booked_by_name from lesson_slot s left join lesson_group g on g.id=s.group_id join person pro on pro.id=s.professional_person_id
    left join lesson_booking b on b.slot_id=s.id and b.status='Booked' and s.group_id is null left join person p on p.id=b.player_person_id left join person actor on actor.id=b.booked_by
    where s.club_id=$1 and s.professional_person_id=$2 and (s.starts_at at time zone 'Europe/Dublin')::date >=$3::date and (s.starts_at at time zone 'Europe/Dublin')::date<$3::date+7 and s.active order by s.starts_at`,[clubId,professionalId,week])
  ]);
  return NextResponse.json({clubs,professionals,actorId:a.user.personId,week,defaultRanges:defaults.rows[0]?.ranges??[],weekRanges:override.rows[0]?.ranges??defaults.rows[0]?.ranges??[],hasOverride:!!override.rowCount,slots:slots.rows});
 }catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
export async function POST(request:Request){
 try{
  const a=await golfAccess(request),b=await request.json();
  const clubId=String(b.clubId??''),professionalId=String(b.professionalId??''),week=weekStart(String(b.week??''));
  requireDiaryOwner(a,clubId,professionalId);
  if(!['default','week','reset'].includes(b.mode))throw new Error('Choose a valid diary action.');
  const first=weekStart(),last=addDays(first,55);
  if(week<first||week>addDays(first,49))throw new Error('Change the current week or one of the next seven weeks.');
  const ranges=b.mode==='reset'?[]:normalizeRanges(b.ranges);
  await withTransaction(async client=>{
   // Always take the coach lock before appointment and slot locks, including across clubs.
   await client.query("select pg_advisory_xact_lock(hashtext('lesson-diary:'||$1::text))",[professionalId]);
   await requireActiveCoach(client,clubId,professionalId);
   if(b.mode==='default')await client.query(`insert into lesson_default_week(club_id,professional_person_id,ranges) values($1,$2,$3::jsonb) on conflict(club_id,professional_person_id) do update set ranges=excluded.ranges,updated_at=now()`,[clubId,professionalId,JSON.stringify(ranges)]);
   else if(b.mode==='reset')await client.query('delete from lesson_week_override where club_id=$1 and professional_person_id=$2 and week_start=$3',[clubId,professionalId,week]);
   else await client.query(`insert into lesson_week_override(club_id,professional_person_id,week_start,ranges) values($1,$2,$3,$4::jsonb) on conflict(club_id,professional_person_id,week_start) do update set ranges=excluded.ranges,updated_at=now()`,[clubId,professionalId,week,JSON.stringify(ranges)]);
   await client.query('select lesson_sync($1,$2,$3,$4,$5,true)',[clubId,professionalId,b.mode==='default'?first:week,b.mode==='default'?last:addDays(week,6),a.user.personId]);
   await golfAudit(client,a.user.personId,'Lesson availability updated',{clubId,professionalId,week,mode:b.mode});
  });return NextResponse.json({ok:true});
 }catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
