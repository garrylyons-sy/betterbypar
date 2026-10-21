// Supports messages already stored in inboxes as well as newly composed draws.
export function cupDrawInboxContent(body){
 const blocks=String(body??'').trim().split(/\n\s*\n/);
 const summary=blocks.shift()??'';
 const rounds=[],schedule=[],notes=[];let footer=null;
 for(const block of blocks){
  if(block.startsWith("Draw made at ")){footer=block;continue;}
  const lines=block.split('\n').map(s=>s.trim()).filter(Boolean);
  const heading=lines.shift()??'',divider=heading.lastIndexOf(' — ');
  const name=divider>=0?heading.slice(0,divider):heading,date=divider>=0?heading.slice(divider+3):'';
  const matches=lines.map(line=>/^(\d+)\.\s+(.+)$/.exec(line)).filter(Boolean).map(match=>({number:match[1],text:match[2]}));
  const placeholdersOnly=matches.length>0&&matches.every(match=>/^Winner of .+ v Winner of .+$/.test(match.text));
  if(date&&(!matches.length||placeholdersOnly)){schedule.push({name,date});continue;}
  if(matches.length){rounds.push({name,date,matches});const extra=lines.filter(line=>!/^\d+\.\s/.test(line));if(extra.length)notes.push(extra.join('\n'));}
  else notes.push(block);
 }
 return {summary,rounds,schedule,notes,footer};
}

export function withCupDrawWitness(body,details={}){
 if(/(?:^|\n)Draw made at /.test(body))return body;
 const witness=typeof details.witnessName==='string'?details.witnessName.trim():'';
 const time=new Date(details.drawnAt??'');
 if(!witness||!Number.isFinite(time.getTime()))return body;
 const stamp=time.toLocaleString('en-IE',{timeZone:'Europe/Dublin',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 return `${body}\n\nDraw made at ${stamp} (Irish time) and witnessed by ${witness}.`;
}
