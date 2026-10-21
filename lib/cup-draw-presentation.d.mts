export type DrawSnapshot = {
 entries:{team_id:string;team_name:string}[];
 rounds:{round_number:number;name:string;fixture_date:string}[];
 bracket:{roundNumber:number;matchNumber:number;homeTeamId:string|null;awayTeamId:string|null;homeSourceMatchNumber?:number|null;awaySourceMatchNumber?:number|null;status:string}[];
 revealOrder?:number[];
};
export function cupDrawRevealOrder(bracket:DrawSnapshot['bracket']):number[];
export function cupDrawPresentation(snapshot:DrawSnapshot,revealedCount?:number):{
 rounds:{roundNumber:number;name:string;date:string;ties:{matchNumber:number;number:number;home:string;away:string;homeBye:boolean;awayBye:boolean}[]}[];
 byes:number;preliminaryMatches:number;total:number;nextLabel:string|null;
};
