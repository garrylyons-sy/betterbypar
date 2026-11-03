export function practiceToday():string;
export function availablePracticeRounds<T extends {playedOn:string}>(rounds:T[],item:{startsOn:string;dueOn:string|null}):T[];
export function practiceProgress(item:{goalSessions:number;sessions:unknown[]}):{completed:number;target:number;fraction:number};
export function drillLogBody(item:{id:string;startsOn:string;dueOn:string|null},form:{date:string;minutes:string;note:string;clientKey:string},today?:string):{action:string;assignmentId:string;performedOn:string;minutes:number;note:string;clientKey:string};
