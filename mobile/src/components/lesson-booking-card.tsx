import {dateLabel as bookingDate} from '../../../shared/golf-presentation.mjs';
import {Alert,Pressable,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import * as Linking from 'expo-linking';
import {Action,Card,Copy} from './ui';
import {useSession} from '../lib/session';
import {useTheme,designTokens as t} from '../lib/theme';
import type {LessonBooking} from '../../../shared/lesson-contracts';
import {lessonBookingStatus,lessonTime,lessonResourceLinks} from '../../../shared/lesson-presentation.mjs';
export function LessonBookingCard({booking:b,now,expanded,onToggle,reminder,onCancel,locked}:{booking:LessonBooking;now:number;expanded:boolean;onToggle:()=>void;reminder:React.ReactNode;onCancel:()=>void;locked:boolean}){
 const theme=useTheme(),{origin}=useSession(),status=lessonBookingStatus(b,now),completed=status==='Completed',future=b.status==='Booked'&&Date.parse(b.starts_at)>now;
 return <Card><Pressable accessibilityRole="button" accessibilityLabel={`${b.group_name||b.title}, ${bookingDate(b.starts_at)} with ${b.professional_name}. ${expanded?'Close':'View'} lesson details`} accessibilityState={{expanded}} onPress={onToggle} style={{gap:10,minHeight:72}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:12}}><View style={{padding:10,backgroundColor:theme.accentSoft,borderRadius:t.radius.button}}><Ionicons name={completed?'checkmark-done-outline':'calendar-outline'} size={24} color={theme.accentText}/></View><View style={{flex:1,gap:3}}><Copy bold style={{color:theme.text,fontSize:17}}>{b.group_name||b.title}</Copy><Copy style={{fontSize:12}}>{bookingDate(b.starts_at)} · {lessonTime(b.starts_at)} – {lessonTime(b.ends_at)}</Copy><Copy style={{fontSize:12}}>{b.player_name} · {b.professional_name}</Copy></View><Ionicons name={expanded?'chevron-up':'chevron-forward'} size={20} color={theme.primaryText}/></View>
  <Copy bold style={{fontSize:11,color:theme.primaryText}}>{status}{completed&&(b.feedback||b.drills)?' · Coaching notes ready':''}</Copy>
 </Pressable>{expanded&&<View style={{gap:10,borderTopWidth:1,borderColor:theme.border,paddingTop:10}}>
  <Copy style={{fontSize:13}}>Location · {b.location_name||'To be confirmed'}</Copy>{b.goals?<View style={{gap:4}}><Copy bold style={{fontSize:13}}>Your goals</Copy><Copy style={{fontSize:13}}>{b.goals}</Copy></View>:<Copy style={{fontSize:12}}>Goals · None added</Copy>}
  {future&&<>{reminder}<Action secondary label="Cancel booking" disabled={locked} onPress={onCancel}/></>}
  {status==='In progress'&&<Copy>Your lesson is taking place now. Coaching notes will appear after your professional adds them.</Copy>}
  {completed&&<><View style={{gap:6,padding:14,borderRadius:t.radius.button,backgroundColor:theme.soft}}><Copy bold style={{color:theme.text}}>Professional feedback</Copy><Copy>{b.feedback||'Your professional has not added feedback yet.'}</Copy></View><View style={{gap:6,padding:14,borderRadius:t.radius.button,backgroundColor:theme.soft}}><Copy bold style={{color:theme.text}}>Drills to practise</Copy><Copy>{b.drills||'Your professional has not added drills for this lesson yet.'}</Copy>{lessonResourceLinks(b.drills).map((url,i)=><Action key={url} secondary label={`Open drill demo${i?' '+(i+1):''}`} onPress={()=>void Linking.openURL(new URL(url,origin).toString()).catch(()=>Alert.alert('Could not open demo','Please try again.'))}/>)}</View><Action label="Open my practice plan" secondary onPress={()=>router.navigate({pathname:'/my-golf',params:{section:'practice',clubId:b.club_id,playerId:b.player_person_id??'',intent:Date.now().toString()}})}/></>}
  {b.status!=='Booked'&&<Copy>This lesson was cancelled.</Copy>}
 </View>}</Card>;
}
