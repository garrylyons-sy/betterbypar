import {notifyLessonEvent} from '@/lib/server/lesson-notifications';
import {scheduleNotificationPush} from '@/lib/server/notification-dispatch';
import {NextResponse} from 'next/server';
import type {PoolClient} from 'pg';
import {dbQuery,withTransaction} from '@/lib/server/db';
import {golfAccess,golfError,golfAudit,AccessError,type GolfAccess} from '@/lib/server/golf-access';
import {requireActiveCoach} from '@/lib/server/lesson-diary';
import {bookLessonForMember} from '@/lib/server/lesson-booking';
import {lessonText} from '@/lib/lesson-diary.mjs';
import {groupCapacity,groupSessionTimes} from '@/lib/lesson-groups.mjs';
export const runtime='nodejs';
const coachRoles=['Golf Professional','Assistant Professional'];
async function ownGroup(client:PoolClient,a:GolfAccess,id:string){
 const found=await client.query('select * from lesson_group where id=$1 and active for update',[id]);
 const group=found.rows[0];if(!group)throw new Error('Coaching group not found.');
 if(group.professional_person_id!==a.user.personId)throw new AccessError('Only this group’s professional can change it.');
 await requireActiveCoach(client,group.club_id,a.user.personId);return group;
}
async function rosterIds(client:PoolClient,groupId:string,clubId:string){
 return (await client.query(`select gm.person_id from lesson_group_member gm join person p on p.id=gm.person_id and p.active where gm.group_id=$1 and gm.active
 and public.is_golf_player(p.id,$2) order by gm.person_id`,[groupId,clubId])).rows.map(r=>String(r.person_id));
}
async function bookRoster(client:PoolClient,a:GolfAccess,slotId:string,ids:string[]){
 let booked=0,notified=0;
 for(const id of ids){
  if((await client.query("select 1 from lesson_booking where slot_id=$1 and player_person_id=$2 and status='Booked'",[slotId,id])).rowCount)continue;
  const result=await bookLessonForMember(client,a,slotId,id,'',1440);booked++;notified+=result.notified;
 }
 return {booked,notified};
}
export async function GET(request:Request){
 try{
  const a=await golfAccess(request),coachClubIds=[...new Set(a.assignments.filter(r=>coachRoles.includes(r.role)).map(r=>r.clubId))],scope=[...new Set([...coachClubIds,...a.adminClubIds])];
  if(!a.platform&&!scope.length)throw new AccessError('Professional or club administrator access required.');
  const clubs=(await dbQuery('select id,name from club where active and ($1::boolean or id=any($2::uuid[])) order by name',[a.platform,scope])).rows;
  const groups=(await dbQuery(`select g.* from lesson_group g join club c on c.id=g.club_id and c.active join person p on p.id=g.professional_person_id and p.active where g.active
   and ($1::boolean or g.club_id=any($2::uuid[]) or g.professional_person_id=$3) and g.club_id=any($4::uuid[])
   and exists(select 1 from club_membership where club_id=g.club_id and person_id=p.id and active and role in ('Golf Professional','Assistant Professional')) order by g.name`,[a.platform,a.adminClubIds,a.user.personId,clubs.map(c=>c.id)])).rows;
  const ids=groups.map(g=>g.id);
  const [members,roster,sessions]=await Promise.all([
   dbQuery(`select distinct p.id,concat_ws(' ',p.first_name,p.last_name) as name,cm.club_id,exists(select 1 from user_account where person_id=p.id and active) as on_platform
    from club_membership cm join person p on p.id=cm.person_id and p.active where cm.active and public.is_golf_player(p.id,cm.club_id) and cm.club_id=any($1::uuid[]) order by name`,[clubs.map(c=>c.id)]),
   dbQuery(`select gm.group_id,gm.person_id from lesson_group_member gm join lesson_group g on g.id=gm.group_id join person p on p.id=gm.person_id and p.active where gm.active and public.is_golf_player(p.id,g.club_id) and gm.group_id=any($1::uuid[]) and exists(select 1 from club_membership where club_id=g.club_id and person_id=p.id and active)`,[ids]),
   dbQuery(`select s.*,coalesce(part.items,'[]'::jsonb) as participants,coalesce(part.booked_count,0)::int as booked_count from lesson_slot s
    left join lateral(select count(*)::int as booked_count,jsonb_agg(jsonb_build_object('id',b.id,'player_person_id',b.player_person_id,'player_name',concat_ws(' ',p.first_name,p.last_name),'goals',b.goals,'feedback',b.feedback,'drills',b.drills) order by p.first_name,p.last_name) as items
     from lesson_booking b join person p on p.id=b.player_person_id where b.slot_id=s.id and b.status='Booked') part on true
    where s.group_id=any($1::uuid[]) and s.ends_at>now()-interval '365 days' order by s.starts_at`,[ids])
  ]);
  return NextResponse.json({actorId:a.user.personId,coachClubIds,canCreate:coachClubIds.length>0,clubs,groups,members:members.rows,roster:roster.rows,sessions:sessions.rows});
 }catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
export async function POST(request:Request){
 try{
  const a=await golfAccess(request),b=await request.json();
  const result=await withTransaction(async client=>{
   if(b.action==='create'){
    const clubId=String(b.clubId??''),name=lessonText(b.name,120,'Group name');if(!name)throw new Error('Give your coaching group a name.');
    if(!['Open','Roster'].includes(b.mode))throw new Error('Choose open booking or a fixed roster.');
    await requireActiveCoach(client,clubId,a.user.personId);
    const group=(await client.query('insert into lesson_group(club_id,professional_person_id,name,mode,capacity,created_by) values($1,$2,$3,$4,$5,$2) returning *',[clubId,a.user.personId,name,b.mode,groupCapacity(b.capacity)])).rows[0];
    await golfAudit(client,a.user.personId,'Coaching group created',{groupId:group.id,name,mode:b.mode});return {group};
   }
   if(b.action==='session'){
    const group=await ownGroup(client,a,String(b.groupId??'')),times=groupSessionTimes(b);
    const cap=Object.hasOwn(b,'capacity')?groupCapacity(b.capacity):group.capacity;
    const roster=group.mode==='Roster'?await rosterIds(client,group.id,group.club_id):[];
    if(cap!==null&&roster.length>cap)throw new Error('The roster is larger than this session’s maximum places.');
    // Serialize against availability generation before reserving the coach's time.
    await client.query("select pg_advisory_xact_lock(hashtext('lesson-diary:'||$1::text))",[a.user.personId]);
    const overlaps=await client.query(`select s.* from lesson_slot s where s.professional_person_id=$1 and s.active and tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange($2::timestamptz,$3::timestamptz,'[)') order by s.starts_at for update`,[a.user.personId,times.startsAt,times.endsAt]);
    for(const slot of overlaps.rows){
     if(!slot.diary_managed||slot.club_id!==group.club_id||(await client.query("select 1 from lesson_booking where slot_id=$1 and status='Booked'",[slot.id])).rowCount)throw new Error('This session overlaps a booked lesson or another reserved session. Choose a different time.');
    }
    for(const slot of overlaps.rows)await client.query('update lesson_slot set active=false where id=$1',[slot.id]);
    const session=(await client.query('insert into lesson_slot(club_id,professional_person_id,title,starts_at,ends_at,created_by,group_id,capacity) values($1,$2,$3,$4,$5,$2,$6,$7) returning *',[group.club_id,a.user.personId,group.name,times.startsAt,times.endsAt,group.id,cap])).rows[0];
    const booked=await bookRoster(client,a,session.id,roster);
    await golfAudit(client,a.user.personId,'Group session scheduled',{groupId:group.id,slotId:session.id,...booked});return {session,...booked};
   }
   if(['bookRoster','cancelSession'].includes(b.action)){
    const found=await client.query('select * from lesson_slot where id=$1 and group_id is not null',[String(b.slotId??'')]);const slot=found.rows[0];if(!slot)throw new Error('Group session not found.');
    const group=await ownGroup(client,a,slot.group_id);
    await client.query('select id from lesson_slot where id=$1 for update',[slot.id]);
    if(new Date(slot.starts_at)<=new Date()||!slot.active)throw new Error('Choose an active upcoming group session.');
    if(b.action==='bookRoster'){
     if(group.mode!=='Roster')throw new Error('This group uses open bookings.');
     return {ok:true,...await bookRoster(client,a,slot.id,await rosterIds(client,group.id,group.club_id))};
    }
    const cancelled=await client.query("update lesson_booking set status='Cancelled',cancelled_at=now(),cancelled_by=$2 where slot_id=$1 and status='Booked' returning id",[slot.id,a.user.personId]);
    for(const booking of cancelled.rows){
     await client.query('delete from lesson_reminder where booking_id=$1',[booking.id]);
     await notifyLessonEvent(client,booking.id,'lesson_cancelled',a.user.personId);
    }
    await client.query('update lesson_slot set active=false where id=$1',[slot.id]);
    await golfAudit(client,a.user.personId,'Group session cancelled',{slotId:slot.id});return {ok:true};
   }
   throw new Error('Choose a valid group action.');
  });scheduleNotificationPush();return NextResponse.json(result,{status:201});
 }catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
export async function PATCH(request:Request){
 try{
  const a=await golfAccess(request),b=await request.json();
  await withTransaction(async client=>{
   const group=await ownGroup(client,a,String(b.groupId??''));
   if(b.action==='update'){
    const name=lessonText(b.name,120,'Group name');if(!name)throw new Error('Give your coaching group a name.');
    const capacity=groupCapacity(b.capacity);
    if(group.mode==='Roster'&&capacity!==null&&(await rosterIds(client,group.id,group.club_id)).length>capacity)throw new Error('The default maximum places is smaller than the active roster. Reduce the roster first or choose a larger maximum.');
    await client.query('update lesson_group set name=$2,capacity=$3 where id=$1',[group.id,name,capacity]);
   }else if(b.action==='roster'){
    if(group.mode!=='Roster')throw new Error('This group uses open bookings.');
    if(!Array.isArray(b.personIds)||b.personIds.length>1000||b.personIds.some((id:unknown)=>typeof id!=='string'))throw new Error('Choose valid group members.');
    const ids=[...new Set(b.personIds)];
    const active=await client.query('select distinct cm.person_id from club_membership cm join person p on p.id=cm.person_id and p.active where cm.club_id=$1 and cm.active and public.is_golf_player(p.id,cm.club_id) and cm.person_id=any($2::uuid[])',[group.club_id,ids]);
    if(active.rows.length!==ids.length)throw new AccessError('Every roster member must be active at this club.');
    if(group.capacity!==null&&ids.length>group.capacity)throw new Error('The roster exceeds the group’s default maximum places.');
    await client.query('update lesson_group_member set active=false where group_id=$1',[group.id]);
    for(const id of ids)await client.query('insert into lesson_group_member(group_id,person_id) values($1,$2) on conflict(group_id,person_id) do update set active=true',[group.id,id]);
   }else throw new Error('Choose a valid group action.');
   await golfAudit(client,a.user.personId,'Coaching group updated',{groupId:group.id,action:b.action});
  });return NextResponse.json({ok:true});
 }catch(error){const e=golfError(error);return NextResponse.json({error:e.error},{status:e.status});}
}
