import type {RoundInput,RoundFeedback,SavedRound} from '@/lib/golf-rounds.mjs';
export type CoachPlayer={clubId:string;clubName:string;playerId:string;name:string};
export type ReviewedRound={id:string;clubId:string;playerId:string;revision:number;source:SavedRound['source'];data:RoundInput;importedGross:number|null;importedPoints:number|null;feedback:RoundFeedback|null};
export type RoundComment={id:string;authorId:string;authorName:string;coach:boolean;holeNumber:number|null;body:string;revision:number;createdAt:string};
export type RoundCoachingData={coach:boolean;options:CoachPlayer[];selected:CoachPlayer|null;rounds:{id:string;courseName:string;playedOn:string;gross:number|null;source:string}[];hasMore:boolean;round:ReviewedRound|null;comments:RoundComment[]};
