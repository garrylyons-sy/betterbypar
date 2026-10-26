import type {RoundInput,RoundFeedback} from '../golf-rounds.mjs';
export const roundCoachInstructions:string;
export function generateRoundFeedback(round:RoundInput,history?:RoundInput[],options?:{env?:Record<string,string|undefined>;fetcher?:typeof fetch}):Promise<RoundFeedback>;
