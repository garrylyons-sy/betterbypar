import {useCallback,useState} from 'react';
import {AppState,Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router,useFocusEffect} from 'expo-router';
import {useSession} from '../lib/session';
import {useTheme,designTokens as t} from '../lib/theme';
import {Action,Card,Copy,useResource} from './ui';
import {lessonDate,lessonTime,lessonRelativeDay,lessonBookingStatus,upcomingHomeLessons} from '../../../shared/lesson-presentation.mjs';
import type {LessonBooking} from '../../../shared/lesson-contracts';
export type UpcomingLessons={actorId:string;bookings:LessonBooking[];total:number};
export function UpcomingLessonCards({data,clubId,now}:{data:UpcomingLessons;clubId:string;now:number}){
 const theme=useTheme(),bookings=upcomingHomeLessons(data.bookings,clubId,now);
 const open=(booking:LessonBooking)=>router.navigate({pathname:'/lessons',params:{booking:booking.id,notificationRequest:Date.now().toString()}});
 if(!bookings.length)return null;
 return <View accessibilityLabel="Upcoming lessons" style={[s.panel,{backgroundColor:theme.primary,borderColor:theme.border}]}>
  <View style={[s.heading,{borderBottomColor:theme.onPrimary+'33'}]}><View style={s.headingLabel}><Ionicons name="calendar-outline" size={20} color={theme.onPrimary}/><Text accessibilityRole="header" style={[s.headingText,{color:theme.onPrimary}]}>Next lesson</Text></View><Pressable accessibilityRole="button" accessibilityLabel="View all scheduled lessons" onPress={()=>open(bookings[0])} style={s.all}><Text style={{fontSize:12,fontWeight:'700',textDecorationLine:'underline',color:theme.onPrimary}}>All lessons{data.total>1?` (${data.total})`:''}</Text></Pressable></View>
  {bookings.map((b,index)=>{const alternate=bookings.length>2&&index%2===1,foreground=alternate?theme.onAccent:theme.onPrimary,background=alternate?theme.accent:theme.primary;return <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={`View lesson: ${b.group_name||b.title}, ${lessonDate(b.starts_at)}, ${lessonTime(b.starts_at)}, with ${b.professional_name}${b.player_person_id!==data.actorId?`, for ${b.player_name}`:''}`} onPress={()=>open(b)} style={({pressed})=>[s.lesson,{opacity:pressed ? 0.8 : 1,borderTopWidth:index?1:0,borderTopColor:foreground+'33',backgroundColor:background}]}>
   <View style={[s.date,{backgroundColor:foreground+'22'}]}><Text style={[s.day,{color:foreground}]}>{lessonBookingStatus(b,now)==='In progress'?'Now':lessonRelativeDay(b.starts_at,now)}</Text><Text style={[s.time,{color:foreground}]}>{lessonTime(b.starts_at)}</Text></View>
   <View style={s.detail}><Text style={[s.title,{color:foreground}]}>{b.group_name||b.title||'Golf lesson'}</Text><Text style={[s.copy,{color:foreground}]}>{b.professional_name}{b.player_person_id!==data.actorId?` · ${b.player_name}`:''}</Text><Text style={[s.small,{color:foreground}]}>{lessonDate(b.starts_at)} · {lessonTime(b.starts_at)}–{lessonTime(b.ends_at)}</Text>{!!b.location_name&&<Text style={[s.small,{color:foreground}]}>{b.location_name}</Text>}<Text style={[s.link,{color:foreground}]}>View lesson</Text></View>
   <Ionicons name="arrow-forward-outline" size={20} color={foreground}/>
  </Pressable>;})}
 </View>;
}
export function NativeUpcomingLessonPanel(){
 const {club}=useSession(),[now,setNow]=useState(()=>Date.now());
 const resource=useResource<UpcomingLessons>(club?`/api/lessons/upcoming?clubId=${encodeURIComponent(club.id)}`:null),reload=resource.reload;
 useFocusEffect(useCallback(()=>{
  const refresh=()=>{setNow(Date.now());reload();};refresh();
  const timer=setInterval(()=>{if(AppState.currentState==='active')refresh();},60000),subscription=AppState.addEventListener('change',state=>{if(state==='active')refresh();});
  return()=>{clearInterval(timer);subscription.remove();};
 },[reload]));
 if(!club)return null;
 if(resource.error)return <Card><Copy>Upcoming lessons unavailable.</Copy><Action label="Try again" secondary onPress={reload}/></Card>;
 if(resource.loading&&!resource.data)return <Copy style={{fontSize:12}}>Checking upcoming lessons…</Copy>;
 return resource.data?<UpcomingLessonCards data={resource.data} clubId={club.id} now={now}/>:null;
}
const s=StyleSheet.create({panel:{borderWidth:1,borderRadius:t.radius.card,overflow:'hidden'},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,borderBottomWidth:1,paddingLeft:14,paddingRight:8},headingLabel:{flexDirection:'row',alignItems:'center',gap:8},headingText:{fontSize:16,fontWeight:'800'},all:{minHeight:t.minTouchTarget,paddingHorizontal:6,justifyContent:'center'},lesson:{minHeight:118,padding:14,flexDirection:'row',alignItems:'center',gap:12},date:{minWidth:66,padding:8,borderRadius:t.radius.button,gap:4,alignItems:'center'},day:{fontSize:10,fontWeight:'800',textTransform:'uppercase'},time:{fontSize:20,fontWeight:'800',fontVariant:['tabular-nums']},detail:{flex:1,gap:4},title:{fontSize:16,fontWeight:'800'},copy:{fontSize:13},small:{fontSize:11,lineHeight:16},link:{fontSize:12,fontWeight:'800',marginTop:3}});
