export type DrawSnapshot = {
 entries:{team_id:string;team_name:string}[];
 rounds:{round_number:number;name:string;fixture_date:string}[];
 bracket:{roundNumber:number;matchNumber:number;homeTeamId:string|null;awayTeamId:string|null;homeSourceMatchNumber?:number|null;awaySourceMatchNumber?:number|null;status:string}[];
 revealOrder?:number[];
};
export function cupDrawRevealOrder(bracket:DrawSnapshot['bracket']):number[];
export type DrawPairing={matchNumber:number;number:number;home:string;away:string;homeBye:boolean;awayBye:boolean;revealState:'revealed'|'hidden'|'future';revealKey:number|null};
export function cupDrawPresentation(snapshot:DrawSnapshot,revealedCount?:number):{
 rounds:{roundNumber:number;name:string;date:string;ties:DrawPairing[]}[];
 byes:number;preliminaryMatches:number;total:number;nextLabel:string|null;
 latestPairing:(DrawPairing & {roundNumber:number;roundName:string;date:string})|null;
};
