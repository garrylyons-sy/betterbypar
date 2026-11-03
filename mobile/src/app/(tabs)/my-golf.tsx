import {useEffect,useRef,useState} from 'react';
import {Alert,ScrollView,View} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
import {NativeRoundsPanel} from '../../components/native-rounds';
import {NativePractice} from '../../components/native-practice';
import {NativeLessons} from '../../components/native-lessons';
import {SectionTabs,EmptyState} from '../../components/golf-controls';
import {Action,Choice,Page,Status,useResource} from '../../components/ui';
import {useSession} from '../../lib/session';
import {useDraftRegistration} from '../../lib/draft-guard';
import type {RoundJournalData} from '../../../../shared/round-contracts';
type Section='rounds'|'practice'|'lessons';
export default function MyGolf(){const {notificationRequest}=useLocalSearchParams<{notificationRequest?:string}>();return <MyGolfContent key={notificationRequest??'default'}/>;}
function MyGolfContent(){
 const {club,session}=useSession(),params=useLocalSearchParams<{playerId?:string;clubId?:string;section?:string;intent?:string;assignment?:string}>();
 const [view,setView]=useState<Section>(params.section==='practice'?'practice':params.section==='lessons'?'lessons':'rounds'),[chosen,setChosen]=useState<{club:string;player:string}|null>(null),[roundDirty,setRoundDirty]=useState(false),[practiceDirty,setPracticeDirty]=useState(false),[lessonDirty,setLessonDirty]=useState(false),[reload,setReload]=useState(0);
 const options=useResource<Pick<RoundJournalData,'options'|'selected'>>(club?`/api/rounds?clubId=${encodeURIComponent(club.id)}`:null);
 const players=options.data?.options.filter(p=>p.clubId===club?.id)??[];
 const requested=params.clubId===club?.id&&typeof params.playerId==='string'?params.playerId:'';
 const preferred=chosen&&chosen.club===club?.id?chosen.player:requested;
 const player=players.find(p=>p.playerId===preferred)?.playerId??players.find(p=>p.playerId===session?.user.personId)?.playerId??options.data?.selected?.playerId;
 const dirty=roundDirty||practiceDirty||lessonDirty;
 useDraftRegistration('my-golf',dirty);
 function leave(action:()=>void){if(dirty)Alert.alert('Discard unsaved changes?','Your unfinished round, lesson or practice details will be cleared.',[{text:'Keep editing',style:'cancel'},{text:'Discard',style:'destructive',onPress:()=>{setRoundDirty(false);setPracticeDirty(false);setLessonDirty(false);action();}}]);else action();}
 const navigationHandled=useRef('');
 useEffect(()=>{if(!params.section)return;const section:Section=params.section==='practice'?'practice':params.section==='lessons'?'lessons':'rounds',key=[params.section,params.clubId,params.playerId,params.intent].join(':');if(navigationHandled.current===key)return;let active=true;void Promise.resolve().then(()=>{if(!active)return;navigationHandled.current=key;const apply=()=>{setRoundDirty(false);setPracticeDirty(false);setLessonDirty(false);setView(section);if(club&&params.clubId===club.id&&params.playerId)setChosen({club:club.id,player:params.playerId});};if(dirty)Alert.alert('Discard unsaved changes?','Your unfinished golf details will be cleared.',[{text:'Keep editing',style:'cancel'},{text:'Discard',style:'destructive',onPress:apply}]);else apply();});return()=>{active=false;};},[params.section,params.clubId,params.playerId,params.intent,club,dirty]);
 return <Page title="My Golf" refreshing={options.loading} onRefresh={()=>leave(()=>{options.reload();setReload(v=>v+1);})}>
  <SectionTabs items={[{id:'rounds',label:'Rounds',icon:'golf-outline'},{id:'practice',label:'Practice',icon:'fitness-outline'},{id:'lessons',label:'Lessons',icon:'calendar-outline'}]} value={view} onChange={section=>{if(section!==view)leave(()=>setView(section));}}/>
  {club?<>
   {view!=='lessons'&&!options.data&&<><Status loading={options.loading} error={options.error}/>{!!options.error&&<Action label="Retry player selection" secondary onPress={options.reload}/>}</>}
   {view!=='lessons'&&players.length>1&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}} accessibilityLabel="Player"><View style={{flexDirection:'row',gap:8}}>{players.map(p=><Choice key={p.playerId} label={p.playerId===session?.user.personId?'Your golf':p.name} selected={p.playerId===player} onPress={()=>{if(p.playerId!==player)leave(()=>setChosen({club:club.id,player:p.playerId}));}}/>)}</View></ScrollView>}
   {view==='rounds'&&options.data&&player&&<NativeRoundsPanel key={`${club.id}:${player}:${reload}`} clubId={club.id} playerId={player} onDirtyChange={setRoundDirty}/>}
   {view==='practice'&&options.data&&player&&<NativePractice key={`${club.id}:${player}:${reload}`} clubId={club.id} playerId={player} assignmentId={params.assignment} onDirtyChange={setPracticeDirty}/>}
   {view!=='lessons'&&options.data&&!player&&<EmptyState title="No player profile" detail="Rounds and practice are available for registered players and their authorised guardians."/>}
   {view==='lessons'&&<NativeLessons embedded personalView onDirtyChange={setLessonDirty}/>}
  </>:<EmptyState title="Choose your club" detail="Select a club in the Club tab to see your rounds, lessons and practice."/>}
 </Page>;
}
