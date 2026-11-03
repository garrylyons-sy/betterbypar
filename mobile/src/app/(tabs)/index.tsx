import {NativeDependantPanel} from '../../components/native-dependants';
import {NativeUpcomingLessonPanel} from '../../components/upcoming-lesson-panel';
import {golfCapabilities} from '../../../../shared/golf-capabilities.mjs';
import {NativeCoachWorkspace} from '../../components/native-coach-workspace';
import {useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {Action,Card,Copy,Page,Status,useResource} from '../../components/ui';
import {GolfOverview} from '../../components/golf-overview';
import {NativeSponsorBanner} from '../../components/native-sponsor-banner';
import {useSession} from '../../lib/session';
import {useTheme,designTokens as t} from '../../lib/theme';
import type {GolfSummaryResponse} from '../../../../shared/golf-summary';
export default function Home(){const {club}=useSession();return golfCapabilities(club?.roles).professional?<NativeCoachWorkspace key={club?.id}/>:<PlayerHome/>;}
function PlayerHome(){
 const {club,session,refreshSession}=useSession(),theme=useTheme();
 const [lessonRefresh,setLessonRefresh]=useState(0);
 const result=useResource<GolfSummaryResponse>(club?`/api/golf-summary?club=${encodeURIComponent(club.name)}`:null);
 return <Page title={`Hello, ${session?.user.name.split(' ')[0]??'golfer'}`} onRefresh={()=>{setLessonRefresh(n=>n+1);void refreshSession().catch(()=>{}).finally(result.reload);}} refreshing={result.loading}>
  <NativeSponsorBanner/>
  <NativeUpcomingLessonPanel key={`lessons:${session?.user.personId}:${club?.id}:${lessonRefresh}`}/>
  <Pressable accessibilityRole="button" accessibilityLabel="Record a round" onPress={()=>router.navigate({pathname:'/record-round',params:{request:Date.now().toString()}})} style={({pressed})=>[s.record,{backgroundColor:theme.primary,opacity:pressed?.85:1}]}><View style={[s.recordIcon,{backgroundColor:theme.accent}]}><Ionicons name="add-outline" size={28} color={theme.onAccent}/></View><Text style={[s.recordLabel,{color:theme.onPrimary}]}>Record a round</Text><Ionicons name="arrow-forward-outline" size={22} color={theme.onPrimary}/></Pressable>
  <Status loading={result.loading} error={result.error}/>
  {!!result.error&&<Action label="Try again" secondary onPress={result.reload}/>}

  {result.data?.summary&&result.data.selectedPlayerId===session?.user.personId?<GolfOverview summary={result.data.summary}/>:!result.loading&&!result.error&&<Card><Copy bold>Your golf, all together</Copy><Copy>{club?'Your Handicap Index and recent rounds will appear here when a player summary is available.':'Choose a club in the Club tab to see your golf.'}</Copy></Card>}
  <NativeDependantPanel key={`family:${session?.user.personId}:${club?.id}:${lessonRefresh}`}/>
  <View style={s.actions}>{([{label:'My Golf',detail:'Rounds & practice',icon:'golf-outline',path:'/my-golf'},{label:'Lessons',detail:'Your next improvement',icon:'calendar-outline',path:'/lessons'}] as const).map(action=><Pressable key={action.label} accessibilityRole="button" accessibilityLabel={`${action.label}: ${action.detail}`} onPress={()=>router.navigate(action.path==='/my-golf'&&club&&session?{pathname:'/my-golf',params:{playerId:session.user.personId,clubId:club.id,section:'rounds',intent:Date.now().toString()}}:action.path)} style={({pressed})=>[s.action,{backgroundColor:action.path==='/my-golf'?theme.primary:theme.surface,borderColor:theme.border,opacity:pressed ? .8 : 1}]}><Ionicons name={action.icon} size={26} color={action.path==='/my-golf'?theme.onPrimary:theme.primaryText}/><Text style={[s.actionTitle,{color:action.path==='/my-golf'?theme.onPrimary:theme.text}]}>{action.label}</Text><Text style={[s.actionDetail,{color:action.path==='/my-golf'?theme.onPrimary:theme.muted}]}>{action.detail}</Text></Pressable>)}</View>
 </Page>;
}
const s=StyleSheet.create({record:{minHeight:72,flexDirection:'row',alignItems:'center',gap:14,padding:14,borderRadius:t.radius.button},recordIcon:{width:42,height:42,borderRadius:t.radius.button,alignItems:'center',justifyContent:'center'},recordLabel:{flex:1,fontSize:19,fontWeight:'800'},actions:{flexDirection:'row',gap:t.spacing.md},action:{flex:1,minHeight:132,borderRadius:t.radius.hero,borderWidth:1,padding:t.spacing.lg,gap:t.spacing.sm},actionTitle:{fontSize:t.type.section,fontWeight:'800'},actionDetail:{fontSize:t.type.small,lineHeight:18}});
