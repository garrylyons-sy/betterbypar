const text=(value,max,label)=>{if(typeof value!=='string'||value.length>max)throw new Error(`${label} must be at most ${max} characters.`);return value.trim();};
export const challengeRules=['no_three_putts','no_double_bogeys','no_lost_balls','gross_max','custom'];
export const practiceCategories=['Putting','Short game','Approach','Tee shots','Course management','Mental game','Other'];
export function normalizeChallenge(input){
 const title=text(input.title,120,'Title'),description=text(input.description??'',2000,'Description');if(!title||!challengeRules.includes(input.rule))throw new Error('Enter a title and a valid challenge rule.');
 const targetValue=input.rule==='gross_max'?input.targetValue:null;if(input.rule==='gross_max'&&(!Number.isInteger(targetValue)||targetValue<20||targetValue>200))throw new Error('Gross score target must be between 20 and 200.');
 return {title,description,rule:input.rule,targetValue};
}
export function demoMedia(value){
 if(typeof value!=='string'||value.length>1000)return null;
 const local=/^\/practice\/demos\/(putting-gate|distance-ladder|landing-zone)$/.exec(value);if(local)return {kind:'animation',src:local[1]};
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(u.hostname)){
   const id=u.hostname==='youtu.be'?u.pathname.slice(1):u.pathname==='/watch'?u.searchParams.get('v'):/^\/(?:embed|shorts)\/([\w-]+)$/.exec(u.pathname)?.[1];
   if(id&&/^[\w-]{11}$/.test(id))return {kind:'embed',src:`https://www.youtube-nocookie.com/embed/${id}`};return null;
  }
  if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(u.hostname)){
   const id=/^\/(?:video\/)?(\d+)$/.exec(u.pathname)?.[1];if(id)return {kind:'embed',src:`https://player.vimeo.com/video/${id}`};return null;
  }
  if(/\.(mp4|webm)$/i.test(u.pathname))return {kind:'video',src:u.href};
 }catch{}
 return null;
}
export function normalizeDrill(input){
 const title=text(input.title,120,'Title'),description=text(input.description??'',3000,'Description'),demoUrl=text(input.demoUrl??'',1000,'Demo link');
 if(!title||!description||!practiceCategories.includes(input.category??'Putting'))throw new Error('Enter a title, description and category.');
 const steps=Array.isArray(input.steps)?input.steps.map(s=>text(s,400,'Step')).filter(Boolean):[];
 if(steps.length<1||steps.length>12)throw new Error('Add 1 to 12 instruction steps.');
 if(!demoMedia(demoUrl))throw new Error('Use a YouTube, Vimeo, HTTPS MP4/WebM link or a built-in demonstration.');
 if(!Number.isInteger(input.minutes)||input.minutes<1||input.minutes>90)throw new Error('Choose 1 to 90 minutes per session.');
 const repetitions=input.repetitions==null?null:input.repetitions;if(repetitions!==null&&(!Number.isInteger(repetitions)||repetitions<1||repetitions>1000))throw new Error('Choose 1 to 1000 repetitions.');
 return {title,description,category:input.category??'Putting',steps,demoUrl,minutes:input.minutes,repetitions,successCriteria:text(input.successCriteria??'',600,'Success criteria')};
}
export function evaluateChallenge(definition,round,requiredHoles=18){
 const make=(outcome,evidence,detail)=>({outcome,evidence,detail});
 if(['custom','no_lost_balls'].includes(definition.rule)&&round&&(round.status!=='completed'||round.holeCount!==requiredHoles||round.holes.length!==requiredHoles||round.holes.some(h=>h.status==='not_played')))return make('ineligible','incomplete','Choose a complete card or attest without linking a partial card.');
 if(['custom','no_lost_balls'].includes(definition.rule))return make('needs_attestation','attestation','This challenge requires the player or guardian to attest to the result.');
 if(!round||round.status!=='completed'||round.holeCount!==requiredHoles||round.holes.length!==requiredHoles||round.holes.some(h=>h.status==='not_played'))return make('ineligible','incomplete','Choose a completed card covering the assigned number of holes.');
 const evidence=round.source==='demo_golf_ireland'?'demo':round.source==='golf_ireland'?'golf_ireland':'player_recorded';
 if(definition.rule==='gross_max'){
  const known=round.holes.reduce((n,h)=>n+(h.strokes??0),0);
  if(known>definition.targetValue)return make('not_met',evidence,`At least ${known} strokes recorded; target ${definition.targetValue} or fewer.`);
  if(round.source!=='manual'&&round.importedGross!=null&&round.importedGross>definition.targetValue)return make('not_met',evidence,`${round.importedGross} strokes recorded; target ${definition.targetValue} or fewer.`);
  if(round.holes.some(h=>h.status==='picked_up'||h.strokes===null))return make('needs_attestation','missing','A picked-up or unknown score prevents a complete gross check.');
  const gross=round.source!=='manual'&&round.importedGross!=null?round.importedGross:round.holes.reduce((n,h)=>n+h.strokes,0);
  return make(gross<=definition.targetValue?'passed':'not_met',evidence,`${gross} strokes recorded; target ${definition.targetValue} or fewer.`);
 }
 if(definition.rule==='no_three_putts'){
  // Putt observations are player-entered even on an imported official card.
  if(round.holes.some(h=>h.putts!=null&&h.putts>=3))return make('not_met',evidence==='demo'?'demo':'player_recorded','At least one hole has three or more recorded putts.');
  if(round.holes.some(h=>h.putts==null||h.status==='picked_up'))return make('needs_attestation','missing','Putt counts are missing or a hole was picked up. Golf Ireland does not supply putt counts here.');
  return make('passed',evidence==='demo'?'demo':'player_recorded','All played holes have fewer than three recorded putts.');
 }
 if(definition.rule==='no_double_bogeys'){
  if(round.holes.some(h=>h.par!=null&&h.strokes!=null&&h.strokes-h.par>=2))return make('not_met',evidence,'At least one recorded hole was double bogey or worse.');
  if(round.holes.some(h=>h.par==null||h.strokes==null||h.status==='picked_up'))return make('needs_attestation','missing','Hole par or a completed stroke score is missing, so a scorecard check cannot decide this.');
  return make('passed',evidence,'Every completed hole was less than two over par.');
 }
 return make('needs_attestation','attestation','This goal requires player or guardian attestation.');
}
