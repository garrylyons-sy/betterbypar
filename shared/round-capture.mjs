// Adapted from Golf project/app.js: COURSE_SEEDS, outcomes, inferredShotMode,
// defaultClubForShot, scoreOnlyRoundView and recordShot. UI and persistence stay platform-specific.
const originalCourseSeeds = [
  { slug: "castle-golf-club-dublin", name: "Castle Golf Club", location: "Dublin, Ireland", pars: "543444344344343554", strokeIndexes: "9,5,17,15,7,1,13,11,3,16,8,10,18,4,14,6,12,2", yards: "482,420,130,307,362,401,157,326,440,175,391,333,122,378,180,509,487,403", teeName: "White" },
  { slug: "erin-hills", name: "Erin Hills", location: "Erin, Wisconsin", pars: "544443543444354345", strokeIndexes: "3,13,7,11,9,15,1,5,17,4,14,10,18,2,12,16,8,6", yards: "485,318,366,387,359,176,503,363,142,421,315,382,162,473,299,145,385,557", teeName: "White" },
  { slug: "mammoth-dunes", name: "Mammoth Dunes", location: "Nekoosa, Wisconsin", pars: "445344534454345345", strokeIndexes: "11,9,3,15,5,13,1,17,7,12,4,8,18,14,6,16,10,2", yards: "350,354,470,157,378,262,511,140,396,290,470,346,105,252,442,127,378,515", teeName: "Sand" },
  { slug: "olympia-fields", name: "Olympia Fields North", aliases: ["Olympia Fields"], location: "Olympia Fields, Illinois", pars: "544443434444345344", strokeIndexes: "5,7,1,9,13,17,11,15,3,8,14,10,18,2,4,16,12,6", yards: "525,426,409,362,359,164,400,189,438,410,358,377,150,420,544,175,373,419", teeName: "Member Regular" },
  { slug: "royal-county-down", name: "Royal County Down", location: "Newcastle, Northern Ireland", pars: "544344344345434445", strokeIndexes: "13,9,3,15,7,11,17,1,5,18,8,16,2,12,4,14,10,6", yards: "539,444,477,228,448,398,145,430,486,197,440,527,444,212,467,337,435,550", teeName: "Championship" },
  { slug: "sand-valley", name: "Sand Valley", location: "Nekoosa, Wisconsin", pars: "443534534545434435", strokeIndexes: "9,7,13,1,15,5,3,17,11,2,12,6,8,18,14,10,16,4", yards: "334,429,212,590,171,484,561,137,298,560,404,475,421,179,424,451,236,524", teeName: "Black" },
  { slug: "sedge-valley", name: "Sedge Valley", location: "Nekoosa, Wisconsin", pars: "444434334454343444", strokeIndexes: "13,9,1,3,7,15,17,11,5,8,2,14,18,6,16,4,10,12", yards: "230,238,299,228,98,165,100,133,242,284,371,155,118,229,115,249,264,235", teeName: "Middle" },
  { slug: "the-belfry-brabazon", name: "The Belfry Brabazon", location: "Sutton Coldfield, England", pars: "445444344443435454", strokeIndexes: "9,17,13,3,11,5,15,1,7,8,16,6,18,14,2,12,10,4", yards: "393,330,512,407,388,430,171,428,433,301,406,188,363,183,545,405,545,441", teeName: "White" },
  { slug: "the-sandbox", name: "The Sandbox", location: "Nekoosa, Wisconsin", pars: "33333333333333333", yards: "84,120,75,83,96,76,51,97,57,101,67,108,62,111,110,142,91", teeName: "Shovels" },
  { slug: "the-lido", name: "The Lido", location: "Nekoosa, Wisconsin", pars: "443545534444434354", strokeIndexes: "11,7,15,1,13,3,5,9,17,6,8,2,16,18,10,12,4,14", yards: "375,396,157,523,338,467,472,212,344,385,427,416,319,128,402,202,550,422", teeName: "White" },
  { slug: "whistling-straits", name: "Whistling Straits", location: "Kohler, Wisconsin", pars: "453454344453444534", strokeIndexes: "15,7,17,1,5,13,9,3,11,12,6,18,14,16,4,10,8,2", yards: "493,597,188,494,603,409,221,506,442,391,645,163,402,396,503,568,249,520", teeName: "Black" },
];
export const coursePresets=originalCourseSeeds.filter(c=>c.pars.length===18);
export function coursePresetFor(name){const key=String(name??'').trim().toLowerCase();return coursePresets.find(c=>[c.name,...(c.aliases??[])].some(n=>n.toLowerCase()===key));}
export function applyCoursePreset(round,slug){if(round.holes.some(h=>h.status!=='not_played'||h.shots.length))throw new Error('The card has already started. Keep its course layout.');const c=coursePresets.find(c=>c.slug===slug);if(!c)throw new Error('Choose a saved course layout.');return {...round,courseName:c.name,teeName:c.teeName,holes:round.holes.map(h=>({...h,par:Number(c.pars[h.number-1])}))};}
export const captureClubs=['DRIVER','WOOD','RESCUE','IRON','WEDGE'];
export const capturePositions=['Short','Long','Left','Right'];
export const captureOutcomes=[
 {label:'Fairway',key:'fairway'},{label:'Rough',key:'rough'},
 {label:'Near green',key:'near_green'},{label:'On green',key:'on_green'},
 {label:'Hole',key:'hole',holed:true},{label:'Trees',key:'trees'},
 {label:'Waste area',key:'waste_area'},{label:'Bunker',key:'bunker'},
 {label:'Hazard',key:'hazard',penalty:true},{label:'OB/Lost',key:'ob',penalty:true},
 {label:'Putt',key:'putt',putt:true},{label:'Putt in hole',key:'putt_in_hole',putt:true,holed:true}
];
export const captureEntryMode=round=>round.entryMode??(round.holes.some(h=>h.shots.length)?'shot_tracking':'score_only');
export function captureShotMode(hole){const last=hole.shots.at(-1);return last?.type==='putt'||last?.outcome==='On green'?'putt':'full';}
export const captureClub=hole=>!hole.shots.length&&[4,5].includes(hole.par)?'DRIVER':'IRON';
export function adjustHoleScore(hole,delta){const minimum=Math.max(1,(hole.putts??0)+(hole.penalties??0));const value=Math.max(minimum,Math.min(30,(hole.strokes??hole.par??4)+delta));return {...hole,status:'played',strokes:value};}
export const pickUpHole=hole=>({...hole,status:'picked_up',strokes:null});
export function appendCaptureShot(hole,input,{readOnlyScore=false}={}){
 const outcome=captureOutcomes.find(o=>o.key===input.outcomeKey);
 if(!outcome)throw new Error('Choose a shot outcome.');
 if(!readOnlyScore&&hole.status!=='not_played')throw new Error('This hole is complete. Reopen it before adding shots.');
 const putt=Boolean(outcome.putt||input.mode==='putt');
 if(Boolean(outcome.putt)!==(input.mode==='putt'))throw new Error('Choose an outcome for the selected shot type.');
 const label=outcome.key==='putt'&&capturePositions.includes(input.position)?`Putt ${input.position.toLowerCase()}`:outcome.label;
 const note=[input.position?`Position: ${input.position}`:'',input.note??''].filter(Boolean).join('. ').slice(0,300);
 const additions=[{type:putt?'putt':'full',club:putt?'PUTTER':input.club||captureClub(hole),outcome:label,note}];
 // The struck ball and the penalty are distinct strokes, including OB/lost balls.
 if(outcome.penalty)additions.push({type:'penalty',club:'',outcome:`${outcome.label} penalty`,note:'Penalty added with previous shot'});
 if(hole.shots.length+additions.length>30)throw new Error('Record at most 30 shots per hole.');
 const shots=[...hole.shots,...additions],next={...hole,shots};
 if(!readOnlyScore&&outcome.holed)return {...next,status:'played',strokes:shots.length,putts:shots.filter(s=>s.type==='putt').length,penalties:shots.filter(s=>s.type==='penalty').length};
 return next;
}
export function undoCaptureShot(hole,_options={}){
 const shots=hole.shots.slice();if(!shots.length)return hole;
 const last=shots.pop();if(last.type==='penalty'&&last.note==='Penalty added with previous shot'&&shots.length)shots.pop();
 // Undo changes observations only. Reopening a completed hole is a separate explicit UI action.
 return {...hole,shots};
}
