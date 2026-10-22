// Presentation only: bracket slots and published fixtures keep their saved identities.
function revealSteps(bracket){
 const first=bracket.filter(t=>t.roundNumber===1).slice().sort((a,b)=>a.matchNumber-b.matchNumber);
 const byes=new Set(first.filter(t=>t.status==='Bye').map(t=>t.matchNumber));
 const games=first.filter(t=>t.status!=='Bye');
 // First-round keys retain their saved match numbers. Later keys use the
 // bracket offset so match 1 in two different rounds cannot share a reveal.
 return [
  ...games.map(t=>({key:t.matchNumber,tie:t})),
  ...bracket.filter(t=>t.roundNumber===2&&(byes.has(t.homeSourceMatchNumber??t.matchNumber*2-1)||byes.has(t.awaySourceMatchNumber??t.matchNumber*2))).slice().sort((a,b)=>a.matchNumber-b.matchNumber).map(t=>({key:first.length+t.matchNumber,tie:t}))
 ];
}
export function cupDrawRevealOrder(bracket){
 return revealSteps(bracket).map(step=>step.key);
}
export function cupDrawPresentation(snapshot,revealedCount=Infinity){
 const first=snapshot.bracket.filter(t=>t.roundNumber===1).slice().sort((a,b)=>a.matchNumber-b.matchNumber);
 const steps=revealSteps(snapshot.bracket);
 const valid=new Set(steps.map(step=>step.key));
 const savedOrder=[...new Set(snapshot.revealOrder??[])].filter(key=>valid.has(key));
 const order=[...savedOrder,...steps.map(step=>step.key).filter(key=>!savedOrder.includes(key))];
 const revealed=new Set(order.slice(0,Math.max(0,revealedCount)));
 const teams=new Map(snapshot.entries.map(e=>[e.team_id,e.team_name]));
 const byes=first.filter(t=>t.status==='Bye').length;
 const games=first.filter(t=>t.status!=='Bye');
 const prelimNumber=new Map(games.map((t,i)=>[t.matchNumber,i+1]));
 const roundName=n=>n===1&&byes?'Preliminary round':snapshot.rounds.find(r=>r.round_number===n)?.name??`Round ${n}`;
 const sourceLabel=(round,number,visible)=>{
  if(!visible)return {name:'Team not revealed',bye:false};
  const source=snapshot.bracket.find(t=>t.roundNumber===round&&t.matchNumber===number);
  if(round===1&&source?.status==='Bye')return {name:teams.get(source.homeTeamId)??'To be decided',bye:true};
  return {name:`Winner of ${round===1&&byes?'Preliminary':roundName(round)} match ${round===1&&byes?prelimNumber.get(number)??number:number}`,bye:false};
 };
 const rounds=snapshot.rounds.map(r=>({roundNumber:r.round_number,name:roundName(r.round_number),date:r.fixture_date,ties:snapshot.bracket.filter(t=>t.roundNumber===r.round_number&&(r.round_number!==1||t.status!=='Bye')).map(t=>{
  const step=steps.find(step=>step.tie===t);
  const visible=!step||revealed.has(step.key);
  const home=r.round_number===1?{name:visible?teams.get(t.homeTeamId)??'To be decided':'Team not revealed',bye:false}:sourceLabel(r.round_number-1,t.homeSourceMatchNumber??t.matchNumber*2-1,visible);
  const away=r.round_number===1?{name:visible?teams.get(t.awayTeamId)??'To be decided':'Team not revealed',bye:false}:sourceLabel(r.round_number-1,t.awaySourceMatchNumber??t.matchNumber*2,visible);
  return {revealState:step?(visible?'revealed':'hidden'):'future',revealKey:step?.key??null,matchNumber:t.matchNumber,number:r.round_number===1&&byes?prelimNumber.get(t.matchNumber):t.matchNumber,home:home.name,away:away.name,homeBye:home.bye,awayBye:away.bye};
 })}));
 const next=steps.find(step=>step.key===order[revealedCount])?.tie;
 const nextLabel=next?(next.roundNumber===1?`Reveal ${byes?'preliminary ':''}match ${byes?prelimNumber.get(next.matchNumber):next.matchNumber}`:`Reveal ${roundName(next.roundNumber)} match ${next.matchNumber}`):null;
 const lastKey=order[Math.min(order.length,Math.max(0,revealedCount))-1];
 let latestPairing=null;
 for(const round of rounds){const tie=round.ties.find(t=>t.revealKey===lastKey&&t.revealState==='revealed');if(tie)latestPairing={...tie,roundNumber:round.roundNumber,roundName:round.name,date:round.date};}
 return {rounds,byes,preliminaryMatches:games.length,total:steps.length,nextLabel,latestPairing};
}
