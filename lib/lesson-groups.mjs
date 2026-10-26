export function groupCapacity(value){
 if(value===null||value===undefined||value==='')return null;
 const n=Number(value);if(!Number.isInteger(n)||n<1||n>1000)throw new Error('Maximum places must be a whole number from 1 to 1000, or leave it empty for no limit.');return n;
}
export function groupSessionTimes(input){
 const s=String(input.startsAt??''),e=String(input.endsAt??'');
 if(![s,e].every(t=>/T.*(Z|[+-]\d{2}:\d{2})$/i.test(t)))throw new Error('Session times require an explicit timezone.');
 const start=new Date(s),end=new Date(e),duration=end-start;
 if(!Number.isFinite(duration)||start<=new Date()||duration<1800000||duration>14400000||duration%1800000||start.getUTCMinutes()%30||start.getUTCSeconds()||start.getUTCMilliseconds())throw new Error('Choose a future session in 30-minute blocks, lasting up to four hours.');
 return {startsAt:start.toISOString(),endsAt:end.toISOString()};
}
