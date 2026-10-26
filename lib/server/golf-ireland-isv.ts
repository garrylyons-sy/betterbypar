import {createHash,createHmac} from 'node:crypto';
import type {GolfSummary,GolfSummaryRequest} from '@/lib/golf-summary';

const api='https://isvapi.clubhouse.golfireland.ie/api/ie/v1';
const failure='Golf Ireland information is unavailable. Please try again later.';
const tokens=new Map<string,{value:string;expiresAt:number}>();
type ObjectValue=Record<string,unknown>;
type Options={env?:Record<string,string|undefined>;fetcher?:typeof fetch;now?:Date};
const object=(value:unknown):ObjectValue=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as ObjectValue:{};
const number=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;
const text=(value:unknown):string=>typeof value==='string'?value:'';
function utc(value:unknown):number{
 const input=text(value);if(!input)return NaN;
 return Date.parse(/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(input)?`${input}Z`:input);
}
async function json(fetcher:typeof fetch,url:string,init:RequestInit):Promise<ObjectValue>{
 const response=await fetcher(url,{...init,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error(failure);
 const data:unknown=await response.json();if(data===null||typeof data!=='object'||Array.isArray(data))throw new Error(failure);
 return object(data);
}

// Credentials and explicit centralMemberCode -> memberUID mappings remain server-only.
// Authentication follows https://isvapi.clubhouse.golfireland.ie/v1documentation.
export async function getLiveGolfSummary(request:GolfSummaryRequest,options:Options={}):Promise<GolfSummary>{
 try{
  const env=options.env??process.env,fetcher=options.fetcher??fetch,now=options.now??new Date();
  const credentials=object(object(JSON.parse(env.GOLF_IRELAND_CLUB_CREDENTIALS??'{}'))[request.clubId]);
  const username=text(credentials.username),secretKey=text(credentials.secretKey);
  const memberUID=text(object(object(JSON.parse(env.GOLF_IRELAND_MEMBER_UIDS??'{}'))[request.clubId])[request.golfIrelandNumber]);
  if(!username.trim()||!secretKey.trim()||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberUID)||!Number.isFinite(now.getTime()))throw new Error(failure);
  const cacheKey=createHash('sha256').update(JSON.stringify([request.clubId,username,secretKey])).digest('hex');
  let token=tokens.get(cacheKey);
  if(!token||token.expiresAt<=now.getTime()){
   tokens.delete(cacheKey);
   const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
   const claims=Buffer.from(JSON.stringify({aud:'isv-api',iss:username,iat:Math.floor(now.getTime()/1000)})).toString('base64url');
   const signature=createHmac('sha256',secretKey).update(`${header}.${claims}`).digest('base64url');
   const auth=await json(fetcher,`${api}/account/token`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({clientToken:`${header}.${claims}.${signature}`})});
   const expiresAt=utc(auth.expiresAtUTC),value=text(auth.accessToken);
   if(!value||!Number.isFinite(expiresAt)||expiresAt<=now.getTime())throw new Error(failure);
   token={value,expiresAt};tokens.set(cacheKey,token);
  }
  let record:ObjectValue;
  try{record=await json(fetcher,`${api}/club/members/${memberUID}/handicap/scores`,{method:'GET',headers:{Authorization:`Bearer ${token.value}`,Accept:'application/json'}});}
  catch{tokens.delete(cacheKey);throw new Error(failure);}
  const handicap=object(record.handicap),index=number(handicap.index);
  const counterScores=Array.isArray(handicap.counterScoreUIDs)?new Set(handicap.counterScoreUIDs.filter((id):id is string=>typeof id==='string')):null;
  const scores=(Array.isArray(record.scores)?record.scores:[]).map(object)
   .filter(score=>score.isDeleted!==true&&text(score.scoreUID)&&Number.isFinite(utc(score.playedAtUTC)))
   .sort((a,b)=>utc(b.playedAtUTC)-utc(a.playedAtUTC));
  const history=scores.filter(score=>number(score.handicapIndex)!==null).map(score=>({date:new Date(utc(score.playedAtUTC)).toISOString(),index:number(score.handicapIndex)!})).reverse();
  if(index!==null)history.push({date:now.toISOString(),index});
  return {
   mode:'live',player:{id:request.playerId,name:request.playerName,golfIrelandNumber:request.golfIrelandNumber,homeClub:request.clubName},
   handicapIndex:index,handicapDisplay:typeof handicap.displayIndex==='string'?handicap.displayIndex:null,
   handicapStatus:handicap.isWithdrawn===true?'withdrawn':handicap.isPending===true?'pending':handicap.isFrozen===true?'frozen':handicap.isProvisional===true?'provisional':index===null?'pending':'active',
   previousHandicapIndex:number(scores[0]?.handicapIndex),lowHandicapIndex:number(handicap.lowIndex),lastUpdatedAt:now.toISOString(),history,
   recentRounds:scores.slice(0,3).map(score=>({id:text(score.scoreUID),date:new Date(utc(score.playedAtUTC)).toISOString(),courseName:text(object(score.marker).course),teeName:text(object(score.marker).name),holes:number(score.holesPlayed),grossScore:number(score.grossScore),stablefordPoints:null,scoreDifferential:number(score.scoreDifferentialPostPCC),counting:counterScores?counterScores.has(text(score.scoreUID)):null})),
   notice:'Recent index history shows indexes at the start of recorded rounds plus the current index. Updated time is when this data was retrieved. Club shown is the selected club context, not a verified home club.'
  };
 }catch{throw new Error(failure);}
}

/** Read a detailed score only after it appears in this member's recent score record. */
export async function getLiveGolfRound(request:GolfSummaryRequest,scoreUID:string,options:Options={}){
 try{
  const env=options.env??process.env,fetcher=options.fetcher??fetch;
  const summary=await getLiveGolfSummary(request,options);
  const brief=summary.recentRounds.find(score=>score.id===scoreUID);
  if(!brief)throw new Error(failure);
  const credentials=object(object(JSON.parse(env.GOLF_IRELAND_CLUB_CREDENTIALS??'{}'))[request.clubId]);
  const memberUID=text(object(object(JSON.parse(env.GOLF_IRELAND_MEMBER_UIDS??'{}'))[request.clubId])[request.golfIrelandNumber]);
  const key=createHash('sha256').update(JSON.stringify([request.clubId,text(credentials.username),text(credentials.secretKey)])).digest('hex');
  const token=tokens.get(key);if(!token)throw new Error(failure);
  const detail=await json(fetcher,`${api}/scores/${encodeURIComponent(scoreUID)}`,{method:'GET',headers:{Authorization:`Bearer ${token.value}`,Accept:'application/json'}});
  if(detail.memberUID!==memberUID||detail.scoreUID!==scoreUID)throw new Error(failure);
  const rawHoles=Array.isArray(detail.holes)?detail.holes.map(object):[];
  const holeCount=[9,18].includes(rawHoles.length)?rawHoles.length:brief.holes;if(holeCount!==9&&holeCount!==18)throw new Error(failure);
  if(rawHoles.length>holeCount)throw new Error(failure);
  const holes=rawHoles.map((h,i)=>({number:i+1,par:null,strokes:h.pickedUp===true||h.didNotAttempt===true?null:number(h.gross),putts:null,penalties:null,status:h.pickedUp===true?'picked_up':h.didNotAttempt===true||number(h.gross)===null?'not_played':'played',comment:'',shots:[]}));
  return {source:'golf_ireland' as const,externalScoreUid:scoreUID,importedGross:brief.grossScore,importedPoints:number(detail.stablefordScore),data:{courseName:brief.courseName,teeName:brief.teeName,playedOn:/^\d{4}-\d{2}-\d{2}T/.test(text(detail.playedAtLocal))?text(detail.playedAtLocal).slice(0,10):brief.date.slice(0,10),holeCount,format:number(detail.stablefordScore)!==null?'stableford':'strokes',status:'completed',commentary:'',handicapIndex:number(detail.handicapIndex),playingHandicap:number(detail.courseHandicap),holes,imported:true}};
 }catch{throw new Error('This Golf Ireland round could not be imported. No changes have been made.');}
}
