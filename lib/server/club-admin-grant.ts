import type {PoolClient} from 'pg';

/** Call inside a transaction: deferred constraints validate the final club officers. */
export async function setClubAdminGrant(client:Pick<PoolClient,'query'>,clubId:string,personId:string,active:boolean) {
  const club=await client.query('select id from public.club where id=$1 for update',[clubId]);
  if(!club.rows.length) throw new Error('Club was not found.');
  if(active){
    const person=await client.query('select id from public.person where id=$1 and active for share',[personId]);
    if(!person.rows.length) throw new Error('Select an active person.');
  }
  await client.query(
    `insert into public.club_admin(person_id,club_id,active) values($1,$2,$3)
     on conflict(club_id,person_id) do update set active=excluded.active`,
    [personId,clubId,active]
  );
  if(active){
    await client.query(
      `insert into public.club_membership(person_id,club_id,role,is_club_admin,active)
       values($1,$2,'Club Member',true,true)
       on conflict(club_id,person_id,role) do update set is_club_admin=true,active=true`,
      [personId,clubId]
    );
  }else{
    await client.query('update public.club_membership set is_club_admin=false where person_id=$1 and club_id=$2',[personId,clubId]);
  }
}
