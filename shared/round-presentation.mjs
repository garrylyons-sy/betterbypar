import {normalizeRound} from '../lib/golf-rounds.mjs';
const blankHole=number=>({number,par:null,strokes:null,putts:null,penalties:null,status:'not_played',comment:'',shots:[]});
export function newRoundCard(courseName='',holeCount=18,now=new Date()){return {courseName,teeName:'',playedOn:now.toLocaleDateString('en-CA',{timeZone:'Europe/Dublin'}),holeCount,format:'strokes',status:'draft',commentary:'',handicapIndex:null,playingHandicap:null,holes:Array.from({length:holeCount},(_,i)=>blankHole(i+1))};}
export function resizeRoundCard(round,holeCount){return {...round,holeCount,holes:Array.from({length:holeCount},(_,i)=>round.holes.find(h=>h.number===i+1)??blankHole(i+1))};}
export const roundSourceLabel=round=>round.source==='golf_ireland'?'Golf Ireland':round.source==='demo_golf_ireland'?'Sample import':'Recorded in app';
export const importModeMessage=mode=>mode==='demo'?'Sample imports · Golf Ireland is not connected.':mode==='live'?'Import a private copy, then add your observations.':'Golf Ireland imports are unavailable for this player right now.';
export function roundSaveInput(round,status,imported=false){return normalizeRound({...round,status,imported});}
export const roundHoleLabel=(source,number)=>`${source==='golf_ireland'||source==='demo_golf_ireland'?'Card hole':'Hole'} ${number}`;
export const roundFeedbackVisible=(round,dirty)=>!!round?.feedback&&!dirty;
export const clampRoundHole=(number,holeCount)=>Math.max(1,Math.min(number,holeCount));
