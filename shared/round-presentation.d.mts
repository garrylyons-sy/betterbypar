import type {RoundInput,SavedRound} from '../lib/golf-rounds.mjs';
export function newRoundCard(courseName?:string,holeCount?:9|18,now?:Date):RoundInput;
export function resizeRoundCard(round:RoundInput,holeCount:9|18):RoundInput;
export function roundSourceLabel(round:Pick<SavedRound,'source'>):string;
export function importModeMessage(mode:string):string;
export function roundSaveInput(round:RoundInput,status:'draft'|'completed',imported?:boolean):RoundInput;
export function roundHoleLabel(source:SavedRound['source']|undefined,number:number):string;
export function roundFeedbackVisible(round:Pick<SavedRound,'feedback'>|null,dirty:boolean):boolean;
export function clampRoundHole(number:number,holeCount:9|18):number;
