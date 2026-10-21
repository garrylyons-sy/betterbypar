// Presentation only: bracket slots and published fixtures keep their saved identities.
export function cupDrawRevealOrder(bracket){
 return bracket.filter(t=>t.roundNumber===1&&t.status!=='Bye').slice().sort((a,b)=>a.matchNumber-b.matchNumber).map(t=>t.matchNumber);
}
export function cupDrawPresentation(snapshot,revealedCount=Infinity){
 const first=snapshot.bracket.filter(t=>t.roundNumber===1).sort((a,b)=>a.matchNumber-b.matchNumber);
 const playable=new Set(first.filter(t=>t.status!=='Bye').map(t=>t.matchNumber));
 const savedOrder=(snapshot.revealOrder??first.map(t=>t.matchNumber)).filter(number=>playable.has(number));
 const order=[...savedOrder,...Array.from(playable).filter(number=>!savedOrder.includes(number))];
 const revealed=new Set(order.slice(0,Math.max(0,revealedCount)));
 const teams=new Map(snapshot.entries.map(e=>[e.team_id,e.team_name]));
 const byes=first.filter(t=>t.status==='Bye').length;
 const games=first.filter(t=>t.status!=='Bye');
 const allPlayableMatchesRevealed=revealed.size>=games.length;
 const prelimNumber=new Map(games.map((t,i)=>[t.matchNumber,i+1]));
 const roundName=n=>n===1&&byes?'Preliminary round':snapshot.rounds.find(r=>r.round_number===n)?.name??`Round ${n}`;
 const sourceLabel=(round,number)=>{
  const source=snapshot.bracket.find(t=>t.roundNumber===round&&t.matchNumber===number);
  if(round===1&&source?.status==='Bye')return {name:allPlayableMatchesRevealed?teams.get(source.homeTeamId)??'To be decided':'Team not revealed',bye:true};
  return {name:`Winner of ${round===1&&byes?'Preliminary':roundName(round)} match ${round===1&&byes?prelimNumber.get(number)??number:number}`,bye:false};
 };
 const rounds=snapshot.rounds.map(r=>({roundNumber:r.round_number,name:roundName(r.round_number),date:r.fixture_date,ties:snapshot.bracket.filter(t=>t.roundNumber===r.round_number&&(r.round_number!==1||t.status!=='Bye')).map(t=>{
  const visible=r.round_number!==1||revealed.has(t.matchNumber);
  const home=r.round_number===1?{name:visible?teams.get(t.homeTeamId)??'To be decided':'Team not revealed',bye:false}:sourceLabel(r.round_number-1,t.homeSourceMatchNumber??t.matchNumber*2-1);
  const away=r.round_number===1?{name:visible?teams.get(t.awayTeamId)??'To be decided':'Team not revealed',bye:false}:sourceLabel(r.round_number-1,t.awaySourceMatchNumber??t.matchNumber*2);
  return {matchNumber:t.matchNumber,number:r.round_number===1&&byes?prelimNumber.get(t.matchNumber):t.matchNumber,home:home.name,away:away.name,homeBye:home.bye,awayBye:away.bye};
 })}));
 const next=first.find(t=>t.matchNumber===order[revealedCount]);
 return {rounds,byes,preliminaryMatches:games.length,total:games.length,nextLabel:next?`Reveal ${byes?'preliminary ':''}match ${byes?prelimNumber.get(next.matchNumber):next.matchNumber}`:null};
}
