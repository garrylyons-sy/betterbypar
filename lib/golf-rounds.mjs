// Adapted from betterbypar-original: round/hole scoring and factual coaching.
const text=(value,max,label)=>{if(typeof value!=='string'||value.length>max)throw new Error(`${label} must be at most ${max} characters.`);return value.trim();};
const optionalNumber=(value,min,max,label,integer=true)=>{if(value==null||value==='')return null;if(typeof value!=='number'||!Number.isFinite(value)||(integer&&!Number.isInteger(value))||value<min||value>max)throw new Error(`${label} must be between ${min} and ${max}.`);return value;};
export function normalizeRound(input,now=new Date()){
 if(!input||typeof input!=='object')throw new Error('Round data required.');
 const courseName=text(input.courseName,160,'Course name');if(!courseName)throw new Error('Enter a course name.');
 const playedOn=text(input.playedOn,10,'Round date');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(playedOn)||!Number.isFinite(Date.parse(playedOn))||new Date(playedOn).toISOString().slice(0,10)!==playedOn||playedOn>now.toLocaleDateString('en-CA',{timeZone:'Europe/Dublin'}))throw new Error('Choose a valid date, today or earlier.');
 if(![9,18].includes(input.holeCount))throw new Error('Choose 9 or 18 holes.');
 if(!['strokes','stableford'].includes(input.format)||!['draft','completed'].includes(input.status))throw new Error('Choose a valid format and round status.');
 if(!Array.isArray(input.holes)||input.holes.length>input.holeCount)throw new Error('Invalid hole card.');
 const seen=new Set();
 const holes=input.holes.map(h=>{
  if(!h||!Number.isInteger(h.number)||h.number<1||h.number>input.holeCount||seen.has(h.number))throw new Error('Each hole must appear once in the card.');seen.add(h.number);
  if(!['played','not_played','picked_up'].includes(h.status))throw new Error('Invalid hole status.');
  const par=optionalNumber(h.par,3,6,'Par'),strokes=optionalNumber(h.strokes,1,30,'Strokes'),putts=optionalNumber(h.putts,0,15,'Putts'),penalties=optionalNumber(h.penalties,0,20,'Penalties');
  if(h.status!=='played'&&strokes!==null)throw new Error('Unplayed or picked-up holes cannot have a completed score.');
  if(h.status==='played'&&strokes===null)throw new Error('Enter strokes or mark the hole unplayed.');
  if(strokes!==null&&((putts??0)+(penalties??0)>strokes))throw new Error('Putts and penalties cannot exceed strokes.');
  const shots=h.shots??[];if(!Array.isArray(shots)||shots.length>30)throw new Error('Record at most 30 shots per hole.');
  return {number:h.number,par,strokes,putts,penalties,status:h.status,comment:text(h.comment??'',1500,'Hole commentary'),shots:shots.map(s=>{
   if(!s||!['full','putt','penalty'].includes(s.type))throw new Error('Choose a valid shot type.');
   return {type:s.type,club:text(s.club??'',30,'Club'),outcome:text(s.outcome??'',80,'Shot outcome'),note:text(s.note??'',300,'Shot note')};
  })};
 }).sort((a,b)=>a.number-b.number);
 for(let number=1;number<=input.holeCount;number++)if(!seen.has(number))holes.push({number,par:null,strokes:null,putts:null,penalties:null,status:'not_played',comment:'',shots:[]});
 holes.sort((a,b)=>a.number-b.number);
 if(input.status==='completed'&&!holes.some(h=>h.status!=='not_played')&&input.imported!==true)throw new Error('Record at least one hole before finishing the round.');
 return {courseName,teeName:text(input.teeName??'',80,'Tee name'),playedOn,holeCount:input.holeCount,format:input.format,status:input.status,commentary:text(input.commentary??'',6000,'Round commentary'),handicapIndex:optionalNumber(input.handicapIndex,-10,54,'Handicap Index',false),playingHandicap:optionalNumber(input.playingHandicap,-10,80,'Playing handicap'),holes};
}
export function roundStats(round){
 const attempted=round.holes.filter(h=>h.status!=='not_played'),scored=attempted.filter(h=>h.strokes!==null),pickedUp=attempted.filter(h=>h.status==='picked_up').length;
 const known=key=>attempted.length&&attempted.every(h=>h[key]!==null)?attempted.reduce((a,h)=>a+h[key],0):null;
 const gross=pickedUp?null:scored.length?scored.reduce((a,h)=>a+h.strokes,0):null;
 const toPar=gross!==null&&scored.every(h=>h.par!==null)?scored.reduce((a,h)=>a+h.strokes-h.par,0):null;
 return {gross,toPar,played:attempted.length,pickedUp,partial:attempted.length<round.holeCount,putts:known('putts'),penalties:known('penalties'),threePutts:attempted.filter(h=>h.putts!==null&&h.putts>=3).length};
}
export function demoRoundFeedback(round){
 const stats=roundStats(round),scored=round.holes.filter(h=>h.strokes!==null),penaltyHoles=round.holes.filter(h=>h.penalties>0),three=round.holes.filter(h=>h.putts>=3);
 const big=scored.filter(h=>h.par!==null&&h.strokes-h.par>=2),notes=round.holes.filter(h=>h.comment||h.shots.length);
 return {mode:'demo',notice:'Rules-based coaching preview, not an AI-generated assessment.',summary:`You recorded ${stats.played} of ${round.holeCount} holes at ${round.courseName}${stats.gross!==null?` with ${stats.gross} strokes`:''}${stats.toPar!==null?` (${stats.toPar>0?'+':''}${stats.toPar} to par)` : ''}. ${stats.partial?'This review covers only the holes you recorded.':''}`.trim(),
  strengths:scored.some(h=>h.par!==null&&h.strokes<=h.par)?['Your card includes a par or better. Use your hole notes to remember the decisions that helped.']:['You have saved a round to review alongside your own observations.'],
  focus:[penaltyHoles.length?`You recorded penalties on ${penaltyHoles.length} hole${penaltyHoles.length===1?'':'s'}. Review the next decision after each penalty.`:notes.length?'Your hole notes add context beyond the score. Review those decisions before deciding what to practise.':'Scores alone do not tell us the cause of a dropped shot. Add hole notes and shot details for a more useful review.',three.length?`You recorded ${three.length} hole${three.length===1?'':'s'} with three or more putts.`:big.length?`${big.length} recorded hole${big.length===1?' was':'s were'} two or more over par. Review their notes before deciding what to practise.`:'Keep notes on one decision you want to repeat and one you want to change.'],
  thoughts:[{title:penaltyHoles.length?'Get back in play':'Review the bigger scores',reason:penaltyHoles.length?`Penalties were recorded on hole ${penaltyHoles[0].number}.`:big.length?`Hole ${big[0].number} was ${big[0].strokes-big[0].par} over par.`:notes.length?`You added observations on hole ${notes[0].number}.`:'Shot causes are not yet recorded.',action:penaltyHoles.length?'After trouble, choose a shot that puts the next one in play.':notes.length?'Use that hole’s notes to choose one decision you would repeat or change.':'Add what happened on one difficult hole before choosing a solution.'},{title:three.length?'Leave the next putt simple':'Notice the scoring shots',reason:three.length?`Hole ${three[0].number} has ${three[0].putts} recorded putts.`:stats.putts!==null?`You recorded ${stats.putts} putts across ${stats.played} hole${stats.played===1?'':'s'}.`:'Putting and short-game detail is limited on this card.',action:three.length?'On a long putt, make leaving a manageable next putt the first goal.':stats.putts!==null?'Keep noting first-putt pace so future reviews can distinguish pace from line.':'Record putts and a short note next time so the review can distinguish putting from approach play.'},{title:'One decision to carry forward',reason:round.commentary?'You added a round reflection.':'No overall reflection has been added yet.',action:'Choose one specific decision from this round to repeat or change next time.'}],
  holes:round.holes.filter(h=>h.status!=='not_played'||h.comment).map(h=>({number:h.number,observation:h.status==='picked_up'?'You marked this hole as picked up.':h.strokes===null?'You added notes without a completed score.':`You recorded ${h.strokes} strokes${h.par!==null?` on a par ${h.par}`:''}${h.putts!==null?` and ${h.putts} putts`:''}.`,question:h.penalties>0?'What was your next decision after the penalty?':h.putts>=3?'What did you notice about the pace of the first putt?':h.par!==null&&h.strokes!==null&&h.strokes-h.par>=2&&!h.comment?'Which decision would you change on this hole?':''}))};
}
