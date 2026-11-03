import type {SavedRound} from '../lib/golf-rounds.mjs';
export type RoundPlayerOption={clubId:string;clubName:string;playerId:string;name:string};
export type RoundJournalData={options:RoundPlayerOption[];selected:RoundPlayerOption|null;rounds:SavedRound[];aiMode:'off'|'demo'|'live';hasMore:boolean;imports:{mode:string;rounds:{id:string;date:string;courseName:string;grossScore:number|null}[]}|null};
export type RoundDiscussionComment={id:string;authorName:string;coach:boolean;holeNumber:number|null;body:string;revision:number;createdAt:string};
export type RoundDiscussionData={comments:RoundDiscussionComment[]};
