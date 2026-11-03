import {useCallback,useEffect,useRef,useState} from 'react';
import {Alert,View} from 'react-native';
import type {RoundCoachingData,ReviewedRound} from '../../../lib/round-coaching-types';
import {roundStats} from '../../../lib/golf-rounds.mjs';
import {roundHoleLabel,roundSourceLabel} from '../../../shared/round-presentation.mjs';
import {useSession} from '../lib/session';
import {Action,Card,Choice,Copy,Status,usePageScrollToTop} from './ui';
import {NativeRoundDiscussion} from './round-discussion';
import {assertCoachingRoundScope,coachingRoundPath,mergeCoachingRoundPage} from './native-round-coaching-data';
const date=(value:string)=>new Date(value.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-IE',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Dublin'});

export function NativeCoachingRounds({clubId,playerId,roundId,onDirtyChange}:{clubId:string;playerId?:string;roundId?:string;onDirtyChange?:(dirty:boolean)=>void}){
 const {request}=useSession(),scrollToTop=usePageScrollToTop();
 const [chosenPlayer,setChosenPlayer]=useState(playerId??''),[requestedRound,setRequestedRound]=useState(roundId),[data,setData]=useState<RoundCoachingData|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(false),[reload,setReload]=useState(0);
 const generation=useRef(0),lock=useRef(false);
 const changeDirty=useCallback((value:boolean)=>{setDirty(value);onDirtyChange?.(value);},[onDirtyChange]);
 useEffect(()=>()=>onDirtyChange?.(false),[onDirtyChange]);
 useEffect(()=>{let active=true;const version=++generation.current;lock.current=false;void Promise.resolve().then(()=>{if(!active)return;setLoading(true);setBusy(false);setData(null);setError('');changeDirty(false);void request<RoundCoachingData>(coachingRoundPath(clubId,chosenPlayer||undefined,requestedRound)).then(next=>{assertCoachingRoundScope(next,clubId,chosenPlayer||undefined);if(active&&generation.current===version)setData(next);}).catch(e=>{if(active&&generation.current===version)setError(e instanceof Error?e.message:'Could not load coached rounds.');}).finally(()=>{if(active&&generation.current===version)setLoading(false);});});return()=>{active=false;generation.current=version+1;};},[request,clubId,chosenPlayer,requestedRound,reload,changeDirty]);
 function leave(action:()=>void){if(lock.current)return;if(dirty)Alert.alert('Discard unsent comment?','Your discussion comment has not been sent.',[{text:'Keep writing',style:'cancel'},{text:'Discard comment',style:'destructive',onPress:()=>{changeDirty(false);action();}}]);else action();}
 async function fetchRound(id?:string,earlier=false){
  if(lock.current||!data?.selected)return;lock.current=true;setBusy(true);setError('');const version=generation.current,selected=data.selected;
  try{const next=await request<RoundCoachingData>(coachingRoundPath(clubId,selected.playerId,id,earlier?data.rounds.length:0));assertCoachingRoundScope(next,clubId,selected.playerId);if(version!==generation.current)return;if(id&&next.round?.id!==id)throw new Error('This round is no longer available.');setData(current=>earlier&&current?mergeCoachingRoundPage(current,next):next);if(!earlier){changeDirty(false);scrollToTop?.();}}
  catch(e){if(version===generation.current){setError(e instanceof Error?e.message:'Could not load this round.');if(!earlier)setData(null);}}
  finally{if(version===generation.current){lock.current=false;setBusy(false);}}
 }
 async function refreshDiscussionRound(){
  if(lock.current||!data?.selected||!data.round)throw new Error('Wait for the current action to finish.');
  lock.current=true;setBusy(true);const version=generation.current,selected=data.selected,id=data.round.id;
  try{const next=await request<RoundCoachingData>(coachingRoundPath(clubId,selected.playerId,id));assertCoachingRoundScope(next,clubId,selected.playerId);if(version!==generation.current)throw new Error('The selected club or player changed.');if(next.round?.id!==id)throw new Error('This round is no longer available.');setData(current=>current?{...current,round:next.round,comments:next.comments}:next);}
  finally{if(version===generation.current){lock.current=false;setBusy(false);}}
 }
 if(loading)return <Card><Status loading error=""/><Copy>Loading completed rounds for your coaching players…</Copy></Card>;
 if(!data)return <Card><Status loading={busy} error={error}/><Copy>Only completed rounds from players you currently coach are available here.</Copy><Action label="Try again" disabled={busy} onPress={()=>setReload(v=>v+1)}/></Card>;
 const options=data.options.filter(p=>p.clubId===clubId),round=data.round;
 return <View style={{gap:16}}><Copy>Review completed rounds and discuss progress with your players and their guardians. Drafts stay private.</Copy><Status loading={busy} error={error}/>
 <Card><Copy bold>Coaching player</Copy>{options.map(p=><Choice key={p.playerId} label={p.name} selected={p.playerId===data.selected?.playerId} onPress={()=>{if(p.playerId!==data.selected?.playerId)leave(()=>{setRequestedRound(undefined);setChosenPlayer(p.playerId);});}}/>)}</Card>
 <Card><Copy bold>{data.selected?.name} · Completed rounds</Copy><Action label="Refresh rounds" secondary disabled={busy} onPress={()=>leave(()=>void fetchRound())}/>{!data.rounds.length&&<Copy>No completed rounds yet. Rounds will appear here when this player finishes and saves one.</Copy>}{data.rounds.map(r=><Choice key={r.id} label={`${r.courseName} · ${date(r.playedOn)}${r.gross==null?'':` · ${r.gross} strokes`}`} selected={r.id===round?.id} onPress={()=>{if(r.id!==round?.id)leave(()=>void fetchRound(r.id));}}/>)}{data.hasMore&&<Action label="Load earlier rounds" secondary disabled={busy} onPress={()=>void fetchRound(undefined,true)}/>}</Card>
 {round&&<><NativeCoachingRoundCard round={round}/><NativeRoundDiscussion key={round.id} roundId={round.id} revision={round.revision} holeCount={round.data.holeCount} source={round.source} coachScope={{clubId,playerId:round.playerId}} onReload={refreshDiscussionRound} disabled={busy} onDirtyChange={changeDirty}/></>}
 </View>;
}
function NativeCoachingRoundCard({round}:{round:ReviewedRound}){
 const stats=roundStats(round.data),feedback=round.feedback;
 return <><Card><Copy bold>{round.data.courseName}</Copy><Copy>{date(round.data.playedOn)} · {round.data.teeName||'Tees not recorded'} · {roundSourceLabel(round)}</Copy><Copy bold>{round.importedGross??stats.gross??'—'} strokes{round.importedPoints!=null?` · ${round.importedPoints} points`:''}</Copy><Copy>{stats.played}/{round.data.holeCount} holes played{stats.toPar==null?'':` · ${stats.toPar>0?'+':''}${stats.toPar} to par`}</Copy>{!!round.data.commentary&&<><Copy bold>Player observations</Copy><Copy>{round.data.commentary}</Copy></>}</Card>
 <Card><Copy bold>Round scorecard</Copy>{round.data.holes.map(hole=><View key={hole.number} style={{gap:6,paddingVertical:8}}><Copy bold>{roundHoleLabel(round.source,hole.number)} · {hole.status==='picked_up'?'Picked up':hole.strokes??'—'}{hole.par==null?'':` · Par ${hole.par}`}</Copy><Copy>Putts {hole.putts??'—'} · Penalties {hole.penalties??'—'}</Copy>{!!hole.comment&&<Copy>{hole.comment}</Copy>}{hole.shots.map((shot,index)=><Copy key={index}>Shot {index+1} · {shot.club||shot.type}{shot.outcome?` · ${shot.outcome}`:''}{shot.note?` · ${shot.note}`:''}</Copy>)}</View>)}</Card>
 {feedback&&<Card><Copy bold>Saved coaching review</Copy><Copy>{feedback.notice}</Copy><Copy bold>{feedback.summary}</Copy><Copy bold>Strengths</Copy>{feedback.strengths.map((item,index)=><Copy key={index}>• {item}</Copy>)}<Copy bold>Focus for next time</Copy>{feedback.focus.map((item,index)=><Copy key={index}>• {item}</Copy>)}{feedback.thoughts.map((thought,index)=><View key={index} style={{gap:6}}><Copy bold>{thought.title}</Copy><Copy>{thought.reason}</Copy><Copy>{thought.action}</Copy></View>)}{feedback.holes.map(hole=><View key={hole.number} style={{gap:6}}><Copy bold>{roundHoleLabel(round.source,hole.number)}</Copy><Copy>{hole.observation}</Copy>{!!hole.question&&<Copy>{hole.question}</Copy>}</View>)}</Card>}</>;
}
