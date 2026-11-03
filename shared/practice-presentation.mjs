export const practiceToday=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Dublin'});
export const availablePracticeRounds=(rounds,item)=>rounds.filter(r=>r.playedOn>=item.startsOn&&(!item.dueOn||r.playedOn<=item.dueOn));
export function practiceProgress(item){const completed=item.sessions.length,target=Math.max(1,item.goalSessions);return {completed,target,fraction:Math.min(1,completed/target)};}
export function drillLogBody(item,{date,minutes,note,clientKey},today=practiceToday()){
 const parsed=new Date(date);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||date<item.startsOn||date>today||(item.dueOn&&date>item.dueOn))throw new Error('Choose a completed date within this practice plan.');
 const duration=Number(minutes);if(!Number.isInteger(duration)||duration<1||duration>180)throw new Error('Enter 1–180 whole minutes.');
 if(typeof note!=='string'||note.length>1000)throw new Error('Keep practice notes to 1,000 characters.');
 return {action:'log',assignmentId:item.id,performedOn:date,minutes:duration,note:note.trim(),clientKey};
}
