import type { PoolClient } from 'pg';
import { dbQuery } from '@/lib/server/db';
import type { Appointments } from '@/lib/golf-policy';
export async function loadAppointments(clubId:string,client?:PoolClient):Promise<Appointments> {
 const query=client?client.query.bind(client):dbQuery;
 const result=await query(`select
  array(select ca.person_id::text from public.club_admin ca join public.person p on p.id=ca.person_id and p.active where ca.club_id=$1 and ca.active
    union select cm.person_id::text from public.club_membership cm join public.person p on p.id=cm.person_id and p.active where cm.club_id=$1 and cm.active and cm.is_club_admin order by 1) as "administratorIds",
  array(select cm.person_id::text from public.club_membership cm join public.person p on p.id=cm.person_id and p.active where cm.club_id=$1 and cm.active and cm.role='Golf Professional' order by 1) as "professionalIds",
  array(select cm.person_id::text from public.club_membership cm join public.person p on p.id=cm.person_id and p.active where cm.club_id=$1 and cm.active and cm.role='Assistant Professional' order by 1) as "assistantProfessionalIds"`,[clubId]);
 return result.rows[0] as Appointments;
}
export async function saveAppointments(client:PoolClient,clubId:string,input:Appointments) {
 const all=[...new Set([...input.administratorIds,...input.professionalIds,...input.assistantProfessionalIds])];
 const people=await client.query('select id from public.person where id=any($1::uuid[]) and active for share',[all]);
 if(people.rowCount!==all.length) throw new Error('Appointments must refer to active people.');
 await client.query('update public.club_admin set active=false where club_id=$1 and not(person_id=any($2::uuid[]))',[clubId,input.administratorIds]);
 await client.query('update public.club_membership set is_club_admin=false where club_id=$1 and is_club_admin and not(person_id=any($2::uuid[]))',[clubId,input.administratorIds]);
 await client.query(`update public.club_membership set active=false where club_id=$1 and
  ((role='Golf Professional' and not(person_id=any($2::uuid[]))) or (role='Assistant Professional' and not(person_id=any($3::uuid[]))))`,[clubId,input.professionalIds,input.assistantProfessionalIds]);
 for(const personId of all) await client.query(`insert into public.club_membership(club_id,person_id,role,active) values($1,$2,'Club Member',true) on conflict(club_id,person_id,role) do update set active=true`,[clubId,personId]);
 for(const personId of input.administratorIds) {
  await client.query(`insert into public.club_admin(club_id,person_id,active) values($1,$2,true) on conflict(club_id,person_id) do update set active=true`,[clubId,personId]);
  await client.query(`update public.club_membership set is_club_admin=true where club_id=$1 and person_id=$2 and role='Club Member'`,[clubId,personId]);
 }
 for(const [role,ids] of [['Golf Professional',input.professionalIds],['Assistant Professional',input.assistantProfessionalIds]] as const) {
  for(const personId of ids) await client.query(`insert into public.club_membership(club_id,person_id,role,active) values($1,$2,$3,true) on conflict(club_id,person_id,role) do update set active=true`,[clubId,personId,role]);
 }
}
