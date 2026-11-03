import type {PoolClient} from 'pg';
/** Count sessions once, regardless of group size. Calendar periods follow the club's Dublin timezone. */
export async function coachingStatistics(client:PoolClient,clubId:string,actorId:string,includeAssistants:boolean){
 return (await client.query(`select p.id,concat_ws(' ',p.first_name,p.last_name) as name,
  case when p.id=$2 then 'Your lessons' else 'Assistant Professional' end as role,
  count(s.id) filter(where s.ends_at<=now() and date_trunc('month',s.starts_at at time zone 'Europe/Dublin')=date_trunc('month',now() at time zone 'Europe/Dublin'))::int as "thisMonth",
  count(s.id) filter(where s.ends_at<=now() and date_trunc('year',s.starts_at at time zone 'Europe/Dublin')=date_trunc('year',now() at time zone 'Europe/Dublin'))::int as "thisYear",
  count(s.id) filter(where s.ends_at>now())::int as upcoming
  from person p left join lesson_slot s on s.professional_person_id=p.id and s.club_id=$1 and s.active
   and exists(select 1 from lesson_booking b where b.slot_id=s.id and b.status='Booked')
  where p.active and exists(select 1 from club_membership cm where cm.person_id=p.id and cm.club_id=$1 and cm.active
   and (p.id=$2 and cm.role in ('Golf Professional','Assistant Professional') or $3::boolean and cm.role='Assistant Professional'))
  group by p.id order by (p.id=$2) desc,p.first_name,p.last_name`,[clubId,actorId,includeAssistants])).rows;
}
