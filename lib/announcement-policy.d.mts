import type {Config} from './notification-policy.mjs';
export type AnnouncementDraft={title:string;body:string;audience:{includeSender?:boolean;roles:string[];clubId:string|null;teamId:string|null;personIds?:string[];channels?:('inbox'|'push'|'email')[]}};
export type AnnouncementRecipient={personId:string;inbox:boolean;push:boolean;email?:boolean};
export type AnnouncementSummary={matched:number;eligible:number;excluded:number;inbox:number;push:number;email?:number;skipped:number;enabled:boolean;announcementsEnabled:boolean};
export const announcementUuidPattern:RegExp;
export function validateAnnouncementDraft(input:unknown):AnnouncementDraft;
export function announcementSelection(rows:{personId:string;roles:string[];preferences:unknown;hasPush?:boolean}[],config:Config,audience?:Pick<AnnouncementDraft['audience'],'personIds'|'channels'>):{summary:AnnouncementSummary;recipients:AnnouncementRecipient[]};
export function announcementPreviewToken(draft:AnnouncementDraft,recipients:AnnouncementRecipient[],config:Config):string;
