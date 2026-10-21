import type { PoolClient } from 'pg';
import {loadNotificationConfig,roleRowsSql} from '@/lib/server/notifications';
import {cupDrawMessage,selectCupDrawRecipients,validateCupDrawAudience} from '@/lib/cup-draw-notification-policy.mjs';

type Queryable=Pick<PoolClient,'query'>;
// Team roles must resolve to an entered team in this cup's season. A club-wide
// role alone does not make someone a player/manager of every team in the club.
export const cupDrawAudienceSql=`with competition_teams as (
 select t.* from public.cup_competition_entry ce join public.cup_competition cc on cc.id=ce.competition_id
 join public.team t on t.id=ce.team_id and t.season_id=cc.season_id and t.active
 join public.club c on c.id=t.club_id and c.active where ce.competition_id=$1
), team_roles as (
 select tm.person_id,tm.role::text as role from public.team_membership tm join competition_teams t on t.id=tm.team_id where tm.active
 union select ptr.person_id,ptr.role::text from public.person_team_role ptr
 join public.club_membership cm on cm.id=ptr.club_membership_id and cm.person_id=ptr.person_id and cm.club_id=ptr.club_id and cm.active
 join competition_teams t on t.club_id=ptr.club_id and t.league_id=ptr.league_id and t.name=ptr.team_name where ptr.active
), recipients as (
 select person_id from (${roleRowsSql}) roles where (role='League Chair' and 'chairs'=any($2::text[])) or (role='Administrator' and 'admins'=any($2::text[]))
 union select person_id from team_roles where (role='Manager' and 'managers'=any($2::text[])) or (role='Player' and 'players'=any($2::text[]))
)
select p.id as "personId",array(select distinct role from (${roleRowsSql}) roles where roles.person_id=p.id) as roles,np.preferences,
 exists(select 1 from public.notification_push_subscription sub where sub.person_id=p.id and sub.active) as "hasPush"
from public.person p left join public.notification_preference np on np.person_id=p.id
where p.active and exists(select 1 from public.user_account ua where ua.person_id=p.id and ua.active)
 and p.id in(select person_id from recipients) order by p.id`;

export async function notifyCupDrawConfirmed(client:Queryable,competitionId:string,attemptId:string){
 const {rows}=await client.query(`select da.snapshot,da.notification_audience,da.created_at as drawn_at,da.witness_name,cc.name from public.cup_draw_attempt da join public.cup_competition cc on cc.id=da.competition_id where da.id=$1 and da.competition_id=$2 and da.status='Confirmed' and cc.status in ('In Progress','Complete')`,[attemptId,competitionId]);
 const draw=rows[0];
 if(!draw)throw new Error('Only a confirmed cup draw can be notified.');
 const audience=validateCupDrawAudience(draw.notification_audience);
 if(!audience.length)return {matched:0,eligible:0,excluded:0,inbox:0,push:0,skipped:0,notified:0};
 const config=await loadNotificationConfig(client);
 const people=await client.query(cupDrawAudienceSql,[competitionId,audience]);
 const {summary,recipients}=selectCupDrawRecipients(people.rows,config);
 if(!recipients.length)return summary;
 await client.query(`with recipients as (select * from jsonb_to_recordset($1::jsonb) as r("personId" uuid,inbox boolean,push boolean)), inserted as (
 insert into public.app_notification(person_id,type,title,body,href,event_key,inbox_visible)
 select "personId",'cup_draw','Cup draw confirmed',$2,'/?notifications=1',$3,inbox from recipients
 on conflict(person_id,event_key) do nothing returning id,person_id
 ) insert into public.notification_push_delivery(notification_id,subscription_id)
 select n.id,s.id from inserted n join recipients r on r."personId"=n.person_id and r.push
 join public.notification_push_subscription s on s.person_id=n.person_id and s.active on conflict do nothing`,
 [JSON.stringify(recipients),cupDrawMessage(draw.name,draw.snapshot,{drawnAt:draw.drawn_at,witnessName:draw.witness_name}),`cup-draw:${competitionId}:${attemptId}`]);
 return summary;
}
