import {useEffect,useRef,useState} from 'react';
import {Alert,Pressable,ScrollView,Switch,Text,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import {Ionicons} from '@expo/vector-icons';
import {Action,Card,Choice,Copy,Status,useResource} from './ui';
import {EmptyState,Field,Input,Metric,SectionTabs} from './golf-controls';
import {useSession} from '../lib/session';
import {useTheme,designTokens as t} from '../lib/theme';
import {practiceToday,practiceProgress,availablePracticeRounds,drillLogBody} from '../../../shared/practice-presentation.mjs';
import {dateLabel} from '../../../shared/golf-presentation.mjs';
import type {PracticeAssignment,PracticeData,PracticeKind} from '../../../shared/practice-contracts';
import type {ChallengeDefinition,DrillDefinition} from '../../../lib/practice-policy.mjs';

export function NativePractice({clubId,playerId,onDirtyChange,assignmentId}:{clubId:string;playerId?:string;assignmentId?:string;onDirtyChange?:(dirty:boolean)=>void}){
 const result=useResource<PracticeData>(`/api/practice?clubId=${encodeURIComponent(clubId)}${playerId?`&playerId=${encodeURIComponent(playerId)}`:''}`),{request}=useSession(),theme=useTheme();
 const [formDirty,setFormDirty]=useState(false);
 useEffect(()=>{onDirtyChange?.(formDirty);return()=>onDirtyChange?.(false);},[formDirty,onDirtyChange]);
 function leave(action:()=>void){if(busy)return;if(formDirty)Alert.alert('Discard practice details?','Your unfinished practice entry will be cleared.',[{text:'Keep editing',style:'cancel'},{text:'Discard',style:'destructive',onPress:action}]);else action();}
 const [kind,setKind]=useState<PracticeKind>('challenge'),[expanded,setExpanded]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const writing=useRef(false),keys=useRef(new Map<string,string>());
 const openedAssignment=useRef('');
 useEffect(()=>{const target=result.data?.assignments.find(a=>a.id===assignmentId);if(!target||openedAssignment.current===target.id)return;let active=true;void Promise.resolve().then(()=>{if(active){openedAssignment.current=target.id;setKind(target.kind);setExpanded(target.id);}});return()=>{active=false;};},[assignmentId,result.data]);
 const data=result.data,items=data?.assignments.filter(a=>a.kind===kind)??[];
 async function mutate(body:Record<string,unknown>){
  if(writing.current)return false;writing.current=true;setBusy(true);setMessage('');
  const signature=JSON.stringify(body),clientKey=keys.current.get(signature)??Crypto.randomUUID();keys.current.set(signature,clientKey);
  try{const saved=await request<{result?:{detail:string}}>('/api/practice',{...body,clientKey});keys.current.delete(signature);setMessage(saved.result?.detail??'Practice session saved. Your professional can see your progress.');result.reload();return true;}
  catch(e){setMessage(`${e instanceof Error?e.message:'Could not save.'} Retrying the same details is safe.`);return false;}
  finally{writing.current=false;setBusy(false);}
 }
 return <View style={{gap:16}}>
  <View><Copy bold style={{fontSize:22,color:theme.text}}>Your practice plan</Copy><Copy>Challenges and drills from your professional.</Copy></View>
  <View style={{flexDirection:'row',gap:8}}><Metric label="Active challenges" value={data?.assignments.filter(a=>a.kind==='challenge'&&a.status==='active').length??'—'}/><Metric label="Active drills" value={data?.assignments.filter(a=>a.kind==='drill'&&a.status==='active').length??'—'}/><Metric label="Sessions logged" value={data?.assignments.reduce((sum,a)=>sum+a.sessions.length,0)??'—'}/></View>
  <SectionTabs items={[{id:'challenge',label:'Challenges',icon:'trophy-outline'},{id:'drill',label:'Drills',icon:'fitness-outline'}]} value={kind} onChange={value=>leave(()=>{setKind(value);setExpanded('');})} disabled={busy}/>
  <Status loading={result.loading} error={result.error}/>
  {!!result.error&&<Action label="Try again" secondary onPress={result.reload}/>}
  {!!message&&<View accessibilityRole="text" accessibilityLiveRegion="polite" style={{padding:14,borderRadius:t.radius.button,backgroundColor:theme.accentSoft}}><Copy style={{color:theme.accentText}}>{message}</Copy></View>}
  {items.map(item=><PracticeCard key={item.id} item={item} expanded={expanded===item.id} onToggle={()=>leave(()=>setExpanded(current=>current===item.id?'':item.id))} busy={busy} rounds={data?.rounds??[]} onDirtyChange={setFormDirty} onAction={body=>mutate({assignmentId:item.id,...body})}/>)}
  {!items.length&&!result.loading&&!result.error&&<EmptyState icon={kind==='challenge'?'trophy-outline':'fitness-outline'} title={`No ${kind==='challenge'?'challenges':'drills'} yet`} detail="Your professional can build a structured plan for you after a lesson."/>}
 </View>;
}

function PracticeCard({item,expanded,onToggle,busy,rounds,onDirtyChange,onAction}:{item:PracticeAssignment;expanded:boolean;onToggle:()=>void;busy:boolean;rounds:PracticeData['rounds'];onDirtyChange:(dirty:boolean)=>void;onAction:(body:Record<string,unknown>)=>Promise<boolean>}){
 const theme=useTheme(),progress=practiceProgress(item),drill=item.definition as DrillDefinition;
 return <Card>
  <View style={{flexDirection:'row',gap:12,alignItems:'center'}}><View style={{padding:12,borderRadius:t.radius.button,backgroundColor:theme.accentSoft}}><Ionicons name={item.kind==='challenge'?'trophy-outline':'fitness-outline'} color={theme.accentText} size={24}/></View><View style={{flex:1}}><Copy bold style={{color:theme.text,fontSize:17}}>{item.definition.title}</Copy><Copy style={{fontSize:12}}>{item.coachName} · {item.status==='cancelled'?'Cancelled':item.kind==='drill'&&progress.fraction===1?'Goal reached':'Active'}</Copy></View></View>
  <Copy>{item.definition.description}</Copy>
  <View style={{flexDirection:'row',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><Copy style={{fontSize:12}}>{item.kind==='drill'?`${progress.completed} / ${progress.target} sessions`:`${item.targetHoles}-hole challenge`}</Copy><Copy style={{fontSize:12}}>{item.dueOn?`Due ${dateLabel(item.dueOn,true)}`:`From ${dateLabel(item.startsOn,true)}`}</Copy></View>
  {item.kind==='drill'&&<View accessibilityRole="progressbar" accessibilityValue={{min:0,max:progress.target,now:Math.min(progress.completed,progress.target)}} style={{height:7,borderRadius:7,backgroundColor:theme.soft,overflow:'hidden'}}><View style={{height:7,width:`${progress.fraction*100}%`,backgroundColor:theme.primaryText}}/></View>}
  {item.latestAttempt&&<View style={{backgroundColor:theme.soft,padding:12,borderRadius:t.radius.button}}><Copy bold>{item.latestAttempt.stale?'Round changed · check again':item.latestAttempt.result.detail}</Copy><Copy style={{fontSize:11}}>Evidence: {item.latestAttempt.result.evidence==='demo'?'Sample round':item.latestAttempt.result.evidence.replace(/_/g,' ')}</Copy></View>}
  <Pressable accessibilityRole="button" accessibilityState={{expanded,disabled:busy}} disabled={busy} onPress={onToggle} style={{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{fontWeight:'700',color:theme.primaryText}}>{expanded?'Close plan details':'View plan & record progress'}</Text><Ionicons name={expanded?'chevron-up':'chevron-down'} size={18} color={theme.primaryText}/></Pressable>
  {expanded&&<>
   {!!item.notes&&<Field label="Coach notes"><Copy>{item.notes}</Copy></Field>}
   {item.kind==='drill'&&<><Copy bold style={{color:theme.text}}>Your drill</Copy>{drill.steps.map((step,i)=><View key={i} style={{flexDirection:'row',gap:10}}><Text style={{color:theme.primaryText,fontWeight:'800'}}>{i+1}.</Text><Copy style={{flex:1}}>{step}</Copy></View>)}<Copy>{drill.minutes} minutes{drill.repetitions?` · ${drill.repetitions} repetitions`:''}</Copy>{!!drill.successCriteria&&<Copy bold>{drill.successCriteria}</Copy>}{!!drill.demoUrl&&<Action label="Open drill demo" secondary onPress={()=>void Linking.openURL(drill.demoUrl).catch(()=>Alert.alert('Demo unavailable','The demonstration could not be opened.'))}/>}</>}
   {item.status==='active'&&<PracticeForm item={item} rounds={rounds} busy={busy} onDirtyChange={onDirtyChange} onAction={onAction}/>}
   {!!item.sessions.length&&<Field label="Recent practice"><View style={{gap:8}}>{item.sessions.slice().sort((a,b)=>b.performedOn.localeCompare(a.performedOn)).slice(0,3).map(session=><View key={session.id} style={{backgroundColor:theme.soft,padding:12,borderRadius:t.radius.button}}><Copy bold>{session.minutes} minutes · {dateLabel(session.performedOn,true)}</Copy>{!!session.note&&<Copy>{session.note}</Copy>}</View>)}</View></Field>}
  </>}
 </Card>;
}

function PracticeForm({item,rounds,busy,onDirtyChange,onAction}:{item:PracticeAssignment;rounds:PracticeData['rounds'];busy:boolean;onDirtyChange:(dirty:boolean)=>void;onAction:(body:Record<string,unknown>)=>Promise<boolean>}){
 const theme=useTheme(),[date,setDate]=useState(practiceToday()),[minutes,setMinutes]=useState(String((item.definition as DrillDefinition).minutes??10)),[note,setNote]=useState(''),[roundId,setRound]=useState(''),[met,setMet]=useState(true),[confirmed,setConfirmed]=useState(false);
 const [baseline,setBaseline]=useState({date:practiceToday(),minutes:String((item.definition as DrillDefinition).minutes??10)});
 const dirty=!!note||!!roundId||confirmed||date!==baseline.date||(item.kind==='drill'&&minutes!==baseline.minutes);
 useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false);},[dirty,onDirtyChange]);
 const available=availablePracticeRounds(rounds,item),attestationOnly=['custom','no_lost_balls'].includes((item.definition as ChallengeDefinition).rule),canAttest=attestationOnly||item.latestAttempt?.result.outcome==='needs_attestation';
 async function submit(action:'log'|'check'|'attest'){
  let body:Record<string,unknown>;
  try{body=action==='log'?drillLogBody(item,{date,minutes,note,clientKey:'pending'}):{action,roundId:roundId||undefined,performedOn:date,note,met,confirmed};delete body.clientKey;}
  catch(e){Alert.alert('Check practice details',e instanceof Error?e.message:'Please check your entries.');return;}
  if(await onAction(body)){setNote('');setConfirmed(false);setRound('');setBaseline({date,minutes});}
 }
 return <View style={{gap:12,padding:14,borderRadius:t.radius.button,backgroundColor:theme.soft}}>
  <Copy bold style={{color:theme.text}}>{item.kind==='drill'?'Record a practice session':'Record a challenge result'}</Copy>
  {item.kind==='challenge'&&<><Field label={attestationOnly?'Link a round · optional':'Completed round'}><ScrollView horizontal contentContainerStyle={{gap:8}}><Choice label={attestationOnly?'No linked round':'Choose a round'} selected={!roundId} onPress={()=>{if(!busy){setRound('');setConfirmed(false);}}}/>{available.map(round=><Choice key={round.id} label={`${dateLabel(round.playedOn,true)} · ${round.courseName}`} selected={round.id===roundId} onPress={()=>{if(!busy){setRound(round.id);setConfirmed(false);}}}/>)}</ScrollView></Field>{!attestationOnly&&<Action label="Check saved round" disabled={busy||!roundId} onPress={()=>void submit('check')}/>}</>}
  {(item.kind==='drill'||canAttest)&&<>
   {(item.kind==='drill'||!roundId)&&<Input label={item.kind==='drill'?'Date completed':'Date played'} hint="YYYY-MM-DD" value={date} onChangeText={setDate} editable={!busy} autoCapitalize="none"/>}
   {item.kind==='drill'?<Input label="Minutes practised" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" editable={!busy}/>:<Field label="Result"><SectionTabs items={[{id:'met',label:'Goal met'},{id:'not-met',label:'Not met'}]} value={met?'met':'not-met'} onChange={value=>{setMet(value==='met');setConfirmed(false);}} disabled={busy}/></Field>}
   <Input label={item.kind==='drill'?'Practice notes · optional':'Attestation note'} multiline maxLength={1000} value={note} onChangeText={setNote} editable={!busy} placeholder={item.kind==='drill'?'What did you notice?':'Explain what you observed or counted.'}/>
   {item.kind==='challenge'&&<View style={{flexDirection:'row',gap:10,alignItems:'center'}}><Switch accessibilityLabel={`I confirm ${item.targetHoles} holes were completed and this result is accurate`} value={confirmed} onValueChange={setConfirmed} disabled={busy}/><Copy style={{flex:1,fontSize:12}}>I confirm {item.targetHoles} holes were completed and this result is accurate.</Copy></View>}
   <Action label={item.kind==='drill'?'Log completed session':'Save attested result'} disabled={busy||(item.kind==='challenge'&&(!confirmed||!note.trim()||(!attestationOnly&&!roundId)))} onPress={()=>void submit(item.kind==='drill'?'log':'attest')}/>
  </>}
  {item.kind==='challenge'&&!available.length&&!attestationOnly&&<Copy>Save or import a completed round within this plan’s dates first.</Copy>}
 </View>;
}
