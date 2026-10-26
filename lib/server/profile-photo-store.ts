import type {PoolClient} from 'pg';

/** Only pass a server-processed WebP data URI, or null to remove the photo.
 * Empty text records an explicit removal so a later Google login cannot restore it. */
export async function storeProfilePhoto(client:Pick<PoolClient,'query'>,actorId:string,playerId:string,clubId:string|null,photo:string|null) {
  const result=await client.query<{id:string;profile_image:string|null}>(
    `update public.person p set profile_image=coalesce($4::text,'')
     where p.id=$2 and p.active
       and exists(select 1 from public.person actor where actor.id=$1 and actor.active)
       and ($1::uuid=$2::uuid or exists(
         select 1 from public.dependants d join public.club c on c.id=d.club_id and c.active
         where d.guardian_person_id=$1 and d.dependant_person_id=p.id and d.club_id=$3::uuid and d.active
           and exists(select 1 from public.club_membership cm where cm.club_id=d.club_id and cm.person_id=$1 and cm.active)
           and exists(select 1 from public.club_membership cm where cm.club_id=d.club_id and cm.person_id=p.id and cm.active)
       ))
     returning p.id,p.profile_image`,[actorId,playerId,clubId,photo]
  );
  if(!result.rows.length) throw Object.assign(new Error('You are not authorised to change this profile photo.'),{status:403});
  await client.query(
    `insert into public.user_activity_log(person_id,activity_type,page_path,page_label,metadata)
     values($1,'Page Visit','/profile',$2,jsonb_build_object('player_id',$3::text,'club_id',$4::text))`,
    [actorId,photo?'Profile photo updated':'Profile photo removed',playerId,clubId]
  );
  return result.rows[0];
}
