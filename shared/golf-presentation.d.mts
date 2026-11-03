import type {GolfSummary,GolfSummaryRound} from './golf-summary';
export function indexLabel(value?:number|null):string;
export function dateLabel(value?:string|null,short?:boolean):string;
export function countingLabel(value?:boolean|null):string;
export type TrendPoint={date:string;index:number;x:number;y:number};
export function trendPoints(history?:{date:string;index:number}[]):TrendPoint[];
export function golfSummaryView(summary?:GolfSummary|null):{handicap:string;rounds:GolfSummaryRound[];movement:number|null;movementLabel:string|null;hasUnknownCounting:boolean;trend:TrendPoint[]};

export const countingSignalColours:Readonly<{green:string;red:string;unknown:string;inactive:string;housing:string}>;
