import type {PoolClient} from 'pg';
import {dbQuery} from '@/lib/server/db';
import {AnnouncementError} from '@/lib/server/notification-announcements';
type Queryable=Pick<PoolClient,'query'>;
export async function isPublisher(personId:string,client:Queryable={query:dbQuery} as Queryable){
 const {rows}=await client.query(`select ap.person_id from public.app_publisher ap join public.person p on p.id=ap.person_id and p.active where ap.person_id=$1 and ap.active and exists(select 1 from public.user_account ua where ua.person_id=p.id and ua.active)`,[personId]);
 return Boolean(rows[0]);
}
export async function requirePublisher(personId:string,client?:Queryable){
 if(!await isPublisher(personId,client))throw new AnnouncementError('Publisher access required.',403);
}
export async function loadPublisherPeople(){
 const {rows}=await dbQuery<{id:string;name:string}>(`select p.id,concat_ws(' ',p.first_name,p.last_name) as name from public.person p where p.active and exists(select 1 from public.user_account ua where ua.person_id=p.id and ua.active) order by p.last_name,p.first_name,p.id`);
 return rows;
}
