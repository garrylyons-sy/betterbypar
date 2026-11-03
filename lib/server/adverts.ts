import {dbQuery} from '@/lib/server/db';
import {safeAdvertImage,safeAdvertLink} from '@/shared/advert-policy.mjs';
import type {SponsorAdvert} from '@/shared/adverts';

// Use stored, active club grants. A client role or a supplied audience never grants access.
export const eligibleAdvertSql=`a.active = true
 and a.placement = 'league-chair-banner'
 and (a.starts_at is null or a.starts_at <= now())
 and (a.ends_at is null or a.ends_at > now())
 and (a.audience = 'Everyone' or (a.audience = 'League Chair' and exists (
  select 1 from public.club_membership cm join public.club c on c.id=cm.club_id and c.active=true
  where cm.person_id=$1 and cm.active=true and cm.role='League Chair'
 )))`;
export async function loadSponsorAdverts(personId:string):Promise<SponsorAdvert[]>{
 const result=await dbQuery<{id:string;name:string;placement:SponsorAdvert['placement'];audience:SponsorAdvert['audience'];image_path:string;link_url:string;affiliate_code:string|null;alt_text:string}>(
  `select a.id::text,a.name,a.placement,a.audience,a.image_path,a.link_url,a.affiliate_code,a.alt_text
   from public.ads a where ${eligibleAdvertSql} order by a.sort_order,a.name,a.id`,[personId]);
 return result.rows.filter(row=>safeAdvertImage(row.image_path)&&safeAdvertLink(row.link_url)).slice(0,1).map(row=>({id:row.id,name:row.name,placement:row.placement,audience:row.audience,imagePath:row.image_path,linkUrl:row.link_url,affiliateCode:row.affiliate_code,altText:row.alt_text}));
}
