export type LiveFixture = {id:string;homeTeam:string;awayTeam:string;fixtureDate:string;competition:string;status:string};
export type MatchLivestream = LiveFixture & {streamId:string;videoId:string;publisherName:string;startedAt:string;expiresAt:string;canEnd:boolean};
export type LivestreamResponse = {streams:MatchLivestream[];canPublish:boolean;canView:boolean};
