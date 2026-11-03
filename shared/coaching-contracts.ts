export type CoachingBooking={id:string;playerId:string;playerName:string;goals:string;feedback:string;drills:string};
export type CoachingSlot={id:string;title:string;locationId?:string|null;locationName?:string|null;startsAt:string;endsAt:string;groupId:string|null;groupName:string|null;capacity:number|null;bookedCount:number;bookings:CoachingBooking[]};
export type CoachingPlayer={id:string;name:string;golfIrelandNumber:string;onPlatform:boolean;lessonCount?:number;upcomingLessonCount?:number};
export type CoachingGroup={id:string;name:string;mode:'Open'|'Roster';capacity:number|null;memberIds:string[]};
export type CoachingStatistic={id:string;name:string;role:string;thisMonth:number;thisYear:number;upcoming:number};
export type CoachingOverview={professionals?:{id:string;name:string;role:string}[];canEditDiary?:boolean;canBookForMember?:boolean;statistics?:CoachingStatistic[];locations?:{id:string;name:string}[];actorId:string;club:{id:string;name:string};professional:{id:string;name:string;role:string};week:string;players:CoachingPlayer[];groups:CoachingGroup[];slots:CoachingSlot[]};
