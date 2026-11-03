import type {PoolClient} from 'pg';
/** Called with the slot locked, inside the booking transaction. Never lets an attendee relocate a shared group. */
export async function setLessonLocation(client:PoolClient,slot:{id:string;club_id:string;location_id?:string|null;group_id?:string|null},locationId:unknown,assignGroup=false){
 if(locationId===undefined||locationId===null||locationId==='')return;
 if(typeof locationId!=='string'||!/^[0-9a-f-]{36}$/i.test(locationId))throw new Error('Choose a valid lesson location.');
 const location=await client.query('select id from lesson_location where id=$1 and club_id=$2 and active for share',[locationId,slot.club_id]);
 if(!location.rowCount)throw new Error('Choose an active location at this lesson’s club.');
 if(slot.location_id===locationId)return;
 if(slot.group_id&&(!assignGroup||slot.location_id))throw new Error('This group’s location is already set by the professional.');
 if((await client.query("select 1 from lesson_booking where slot_id=$1 and status='Booked' limit 1",[slot.id])).rowCount)throw new Error('This lesson already has bookings; its location cannot be changed here.');
 await client.query('update lesson_slot set location_id=$2 where id=$1',[slot.id,locationId]);
}
