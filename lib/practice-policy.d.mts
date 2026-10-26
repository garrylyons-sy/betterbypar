import type {SavedRound} from './golf-rounds.mjs';
export type ChallengeDefinition={title:string;description:string;rule:'no_three_putts'|'no_double_bogeys'|'no_lost_balls'|'gross_max'|'custom';targetValue:number|null};
export type DrillDefinition={title:string;description:string;category:string;steps:string[];demoUrl:string;minutes:number;repetitions:number|null;successCriteria:string};
export type ChallengeResult={outcome:'passed'|'not_met'|'needs_attestation'|'ineligible';evidence:'golf_ireland'|'player_recorded'|'demo'|'attestation'|'missing'|'incomplete';detail:string};
export const challengeRules:string[];export const practiceCategories:string[];
export function normalizeChallenge(input:unknown):ChallengeDefinition;
export function normalizeDrill(input:unknown):DrillDefinition;
export function demoMedia(value:unknown):{kind:'animation'|'embed'|'video';src:string}|null;
export function evaluateChallenge(definition:ChallengeDefinition,round:SavedRound|null,requiredHoles?:number):ChallengeResult;
