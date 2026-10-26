export type GolfSummaryPlayer={id:string;name:string;golfIrelandNumber:string;homeClub:string};
export type GolfSummaryRound={id:string;date:string;courseName:string;teeName:string;holes:number|null;grossScore:number|null;stablefordPoints:number|null;scoreDifferential:number|null;counting:boolean|null};
export type GolfSummary={mode:'demo'|'live'|'unavailable';player:GolfSummaryPlayer;handicapIndex:number|null;handicapDisplay:string|null;handicapStatus:'active'|'pending'|'withdrawn'|'provisional'|'frozen';previousHandicapIndex:number|null;lowHandicapIndex:number|null;lastUpdatedAt:string|null;history:{date:string;index:number}[];recentRounds:GolfSummaryRound[];notice:string|null};
export type GolfSummaryRequest={clubId:string;clubName:string;playerId:string;playerName:string;golfIrelandNumber:string};
export type GolfSummaryResponse={players:{id:string;name:string;isSelf:boolean}[];selectedPlayerId:string|null;summary:GolfSummary|null};
