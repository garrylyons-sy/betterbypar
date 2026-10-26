import type {PoolClient} from 'pg';
import type {ClubBrandingInput} from '@/lib/server/admin-clubs';

type QueryClient = Pick<PoolClient,'query'>;
export type ClubBrandingRow = {
  id:string; name:string; logo_path:string|null; primary_color:string|null; accent_color:string|null;
};

// The club portal always requires a club appointment, even for platform operators.
const appointedAdmin = `exists(select 1 from public.person p where p.id=$1 and p.active)
  and (exists(select 1 from public.club_admin ca where ca.person_id=$1 and ca.club_id=c.id and ca.active)
    or exists(select 1 from public.club_membership cm where cm.person_id=$1 and cm.club_id=c.id and cm.active and cm.is_club_admin))`;

export async function listClubBranding(client:QueryClient,personId:string):Promise<ClubBrandingRow[]> {
  const result=await client.query<ClubBrandingRow>(
    `select c.id,c.name,c.logo_path,c.primary_color,c.accent_color from public.club c
     where c.active and ${appointedAdmin} order by c.name`,[personId]
  );
  return result.rows;
}

/** Must run inside a transaction so branding and its audit event commit together. */
export async function saveClubBranding(client:QueryClient,personId:string,clubId:string,input:ClubBrandingInput):Promise<ClubBrandingRow> {
  const updated=await client.query<ClubBrandingRow>(
    `update public.club c set logo_path=$3,primary_color=$4,accent_color=$5,updated_at=now()
     where c.id=$2 and c.active and ${appointedAdmin}
     returning c.id,c.name,c.logo_path,c.primary_color,c.accent_color`,
    [personId,clubId,input.logoPath,input.primaryColor,input.accentColor]
  );
  if(!updated.rows.length) throw Object.assign(new Error('Club administrator access is required for this club.'),{status:403});
  const club=updated.rows[0];
  await client.query(
    `insert into public.user_activity_log(person_id,activity_type,page_path,page_label,metadata)
     values($1,'Page Visit','/clubadmin','Club branding updated',jsonb_build_object('club_id',$2::text,'club_name',$3::text))`,
    [personId,club.id,club.name]
  );
  return club;
}
