const formatter=locale=>new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',year:'numeric',calendar:'gregory',numberingSystem:'latn',timeZone:'UTC'});
export function roundDatePattern(locale){return formatter(locale).formatToParts(new Date('2006-11-22T12:00:00Z')).map(p=>p.type==='day'?'dd':p.type==='month'?'mm':p.type==='year'?'yyyy':p.value).join('');}
export function formatRoundDate(iso,locale){if(!/^\d{4}-\d{2}-\d{2}$/.test(iso??''))return '';const date=new Date(`${iso}T12:00:00Z`);return Number.isFinite(+date)&&date.toISOString().slice(0,10)===iso?formatter(locale).format(date):'';}
export function parseRoundDate(text,locale){
 const parts=formatter(locale).formatToParts(new Date('2006-11-22T12:00:00Z')).filter(p=>['day','month','year'].includes(p.type));
 const numbers=String(text).trim().match(/^(\d{1,4})[\s./-]+(\d{1,2})[\s./-]+(\d{1,4})$/);if(!numbers)return null;
 const fields=Object.fromEntries(parts.map((p,i)=>[p.type,numbers[i+1]]));if(fields.year.length!==4)return null;
 const iso=`${fields.year}-${fields.month.padStart(2,'0')}-${fields.day.padStart(2,'0')}`,date=new Date(`${iso}T12:00:00Z`);
 return Number.isFinite(+date)&&date.toISOString().slice(0,10)===iso?iso:null;
}
