import type {RoundCoachingData} from '../../../lib/round-coaching-types';

export function coachingRoundPath(clubId:string,playerId?:string,roundId?:string,offset=0){
 const params=new URLSearchParams({view:'coach',clubId});
 if(playerId)params.set('playerId',playerId);
 if(roundId)params.set('roundId',roundId);
 if(offset)params.set('offset',String(offset));
 return `/api/round-coaching?${params}`;
}
export function assertCoachingRoundScope(data:RoundCoachingData,clubId:string,playerId?:string){
 const selected=data.selected;
 if(!data.coach||!selected||selected.clubId!==clubId||(playerId&&selected.playerId!==playerId)||!data.options.some(p=>p.clubId===selected.clubId&&p.playerId===selected.playerId))throw new Error('Choose a player you currently coach at this club.');
 if(data.round&&(data.round.clubId!==selected.clubId||data.round.playerId!==selected.playerId||data.round.data.status!=='completed'))throw new Error('This completed round is no longer available for this player.');
}
export function mergeCoachingRoundPage(current:RoundCoachingData,next:RoundCoachingData):RoundCoachingData{
 if(!current.selected||!next.selected||current.selected.clubId!==next.selected.clubId||current.selected.playerId!==next.selected.playerId)throw new Error('The selected player changed. Refresh their round history.');
 return {...next,rounds:[...new Map([...current.rounds,...next.rounds].map(r=>[r.id,r])).values()],round:current.round,comments:current.comments};
}
