import type {Config} from './notification-policy.mjs';
export type AnnouncementDraft={title:string;body:string;audience:{roles:string[];clubId:string|null;teamId:string|null}};
export type AnnouncementRecipient={personId:string;inbox:boolean;push:boolean};
export type AnnouncementSummary={matched:number;eligible:number;excluded:number;inbox:number;push:number;skipped:number;enabled:boolean;announcementsEnabled:boolean};
export const announcementUuidPattern:RegExp;
export function validateAnnouncementDraft(input:unknown):AnnouncementDraft;
export function announcementSelection(rows:{personId:string;roles:string[];preferences:unknown;hasPush?:boolean}[],config:Config):{summary:AnnouncementSummary;recipients:AnnouncementRecipient[]};
export function announcementPreviewToken(draft:AnnouncementDraft,recipients:AnnouncementRecipient[],config:Config):string;
