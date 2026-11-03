/** Framework-free API contracts consumed by the native client. */
export type NativeClub={id:string;name:string;logoPath?:string|null;primaryColor:string;accentColor:string;roles:string[]};
export type NativeSession={user:{accountId:string;personId:string;name:string;email:string;profileImage:string};clubs:NativeClub[];demo:boolean};
export type NativeLogin={token:string;expiresAt:string;user:NativeSession['user']};
export type {GolfSummaryResponse} from './golf-summary';
export type {RoundJournalData as NativeRounds} from './round-contracts';
export type {PracticeData as NativePractice} from './practice-contracts';
export type {MemberLessonData as NativeLessons} from './lesson-contracts';
