import {useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {Action,Card,Choice,Copy,Page,Status,useResource} from '../../components/ui';
import {GolfOverview} from '../../components/golf-overview';
import {useSession} from '../../lib/session';
import {useTheme,designTokens as t} from '../../lib/theme';
import type {GolfSummaryResponse} from '../../../../shared/golf-summary';
export default function Home(){
 const {club,session,refreshSession}=useSession(),theme=useTheme();
 const [selection,setSelection]=useState<{club:string;player:string}|null>(null);
 const player=selection?.club===club?.id?selection?.player:'';
 const result=useResource<GolfSummaryResponse>(club?`/api/golf-summary?club=${encodeURIComponent(club.name)}${player?`&playerId=${encodeURIComponent(player)}`:''}`:null);
 return <Page title={`Hello, ${session?.user.name.split(' ')[0]??'golfer'}`} onRefresh={()=>{void refreshSession().catch(()=>{}).finally(result.reload);}} refreshing={result.loading}>
  <Pressable accessibilityRole="button" accessibilityLabel="Record a round" onPress={()=>router.navigate({pathname:'/record-round',params:{request:Date.now().toString()}})} style={({pressed})=>[s.record,{backgroundColor:theme.primary,opacity:pressed?.85:1}]}><View style={[s.recordIcon,{backgroundColor:theme.accent}]}><Ionicons name="add-outline" size={28} color={theme.onAccent}/></View><Text style={[s.recordLabel,{color:theme.onPrimary}]}>Record a round</Text><Ionicons name="arrow-forward-outline" size={22} color={theme.onPrimary}/></Pressable>
  <Status loading={result.loading} error={result.error}/>
  {!!result.error&&<Action label="Try again" secondary onPress={result.reload}/>}
  {(result.data?.players.length??0)>1&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:t.spacing.sm}} accessibilityLabel="Choose whose golf to view">{result.data?.players.map(p=><Choice key={p.id} label={p.isSelf?'Your golf':p.name} selected={result.data?.selectedPlayerId===p.id} onPress={()=>setSelection({club:club!.id,player:p.id})}/>)}</ScrollView>}
  {result.data?.summary?<GolfOverview summary={result.data.summary}/>:!result.loading&&!result.error&&<Card><Copy bold>Your golf, all together</Copy><Copy>{club?'Your Handicap Index and recent rounds will appear here when a player summary is available.':'Choose a club in the Club tab to see your golf.'}</Copy></Card>}
  <View style={s.actions}>{([{label:'My Golf',detail:'Rounds & practice',icon:'golf-outline',path:'/my-golf'},{label:'Lessons',detail:'Your next improvement',icon:'calendar-outline',path:'/lessons'}] as const).map(action=><Pressable key={action.label} accessibilityRole="button" accessibilityLabel={`${action.label}: ${action.detail}`} onPress={()=>router.navigate(action.path)} style={({pressed})=>[s.action,{backgroundColor:action.path==='/my-golf'?theme.primary:theme.surface,borderColor:theme.border,opacity:pressed ? .8 : 1}]}><Ionicons name={action.icon} size={26} color={action.path==='/my-golf'?theme.onPrimary:theme.primaryText}/><Text style={[s.actionTitle,{color:action.path==='/my-golf'?theme.onPrimary:theme.text}]}>{action.label}</Text><Text style={[s.actionDetail,{color:action.path==='/my-golf'?theme.onPrimary:theme.muted}]}>{action.detail}</Text></Pressable>)}</View>
 </Page>;
}
const s=StyleSheet.create({record:{minHeight:72,flexDirection:'row',alignItems:'center',gap:14,padding:14,borderRadius:t.radius.button},recordIcon:{width:42,height:42,borderRadius:t.radius.button,alignItems:'center',justifyContent:'center'},recordLabel:{flex:1,fontSize:19,fontWeight:'800'},actions:{flexDirection:'row',gap:t.spacing.md},action:{flex:1,minHeight:132,borderRadius:t.radius.hero,borderWidth:1,padding:t.spacing.lg,gap:t.spacing.sm},actionTitle:{fontSize:t.type.section,fontWeight:'800'},actionDetail:{fontSize:t.type.small,lineHeight:18}});
