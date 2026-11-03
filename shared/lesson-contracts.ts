/** Member lesson API response. Eligibility and attendee visibility are server supplied. */
export type LessonSlot={id:string;club_id:string;club_name:string;title:string;professional_person_id?:string;professional_name:string;professional_role?:string|null;starts_at:string;ends_at:string;booked:boolean;group_id?:string|null;group_name?:string|null;group_mode?:'Open'|'Roster'|null;capacity?:number|null;booked_count?:number;eligible_player_ids?:string[];attendee_names?:string[]};
export type LessonBooking={id:string;club_id:string;slot_id?:string;player_person_id?:string;group_id?:string|null;group_name?:string|null;title:string;starts_at:string;ends_at:string;professional_name:string;player_name:string;status:string;goals?:string|null;reminder_minutes?:number;feedback?:string|null;drills?:string|null;reminder_due?:boolean};
export type LessonPlayer={id:string;name:string;club_id:string};
export type MemberLessonData={actorId?:string;canManage:boolean;slots:LessonSlot[];players:LessonPlayer[];bookings:LessonBooking[];reminderEmailReady?:boolean};
export type LessonBookingInput={slotId:string;playerId:string;goals:string;reminderMinutes:number};
