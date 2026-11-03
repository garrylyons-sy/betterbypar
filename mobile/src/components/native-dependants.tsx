import {useCallback,useState} from 'react';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router,useFocusEffect} from 'expo-router';
import {Action,Card,Copy,Page,Status,useResource} from './ui';
import {NativeProfilePhotoEditor} from './native-profile';
import {EmptyState,Input} from './golf-controls';
import {useSession} from '../lib/session';
import {useDraftGuard,useDraftRegistration} from '../lib/draft-guard';
import {useTheme,designTokens as t} from '../lib/theme';
import type {GolfSummaryResponse} from '../../../shared/golf-summary';
import type {Dependant,DependantsResponse} from '../../../shared/dependants';

export function DependantCards({rows,clubId}:{rows:Dependant[];clubId:string}){
 const theme=useTheme(),dependants=rows.filter(row=>row.club_id===clubId);
 if(!dependants.length)return null;
 return <View style={{gap:t.spacing.md}} accessibilityLabel="Your players">
  <Copy bold style={{color:theme.text,fontSize:t.type.section}}>Your players</Copy>
  {dependants.map(row=><DependantGolfCard key={row.id} row={row}/>)}
 </View>;
}
function DependantGolfCard({row}:{row:Dependant}){
 const theme=useTheme(),name=`${row.first_name} ${row.last_name}`;
 const resource=useResource<GolfSummaryResponse>(`/api/golf-summary?club=${encodeURIComponent(row.club_name)}&playerId=${encodeURIComponent(row.player_id)}`),reload=resource.reload;
 useFocusEffect(useCallback(()=>{reload();},[reload]));
 const summary=resource.data?.selectedPlayerId===row.player_id&&resource.data.summary?.player.id===row.player_id?resource.data.summary:null,latest=summary?.recentRounds[0];
 const date=latest&&Number.isFinite(Date.parse(latest.date))?new Date(latest.date).toLocaleDateString('en-IE',{day:'numeric',month:'short',timeZone:'Europe/Dublin'}):'No round data yet';
 return <Pressable accessibilityRole="button" accessibilityLabel={`View ${name}'s golf`} onPress={()=>router.navigate({pathname:'/my-golf',params:{playerId:row.player_id,clubId:row.club_id,section:'rounds',intent:Date.now().toString()}})} style={({pressed})=>[s.card,{backgroundColor:theme.surface,borderColor:theme.border,opacity:pressed?.8:1}]}>
  <View style={s.player}>
   {row.profile_image?<Image source={{uri:row.profile_image}} accessibilityLabel={`${name}'s profile photo`} style={s.avatar}/>:<View style={[s.avatar,{backgroundColor:theme.soft}]}><Ionicons name="person-outline" color={theme.primaryText} size={28}/></View>}
   <View style={{flex:1,gap:4}}><Text style={[s.name,{color:theme.text}]}>{name}</Text><Copy style={{fontSize:12,lineHeight:18}}>{row.club_name}</Copy></View><Ionicons name="chevron-forward" size={22} color={theme.primaryText}/>
  </View>
  <View style={[s.stats,{backgroundColor:theme.soft}]}>
   <View style={s.stat}><Copy style={s.small}>Handicap Index</Copy><Text style={[s.value,{color:theme.primaryText}]}>{summary?.handicapDisplay||'—'}</Text>{summary?.handicapStatus&&summary.handicapStatus!=='active'&&<Copy style={s.small}>{summary.handicapStatus}</Copy>}</View>
   <View style={s.stat}><Copy style={s.small}>Last round</Copy><Text style={[s.value,{color:theme.primaryText}]}>{latest?.grossScore??'—'}</Text><Copy style={s.small}>{date}</Copy></View>
  </View>
  <View style={s.footer}><Copy style={s.small}>{resource.loading&&!summary?'Loading golf summary…':summary?.mode==='demo'?'Sample golf data':summary?.mode==='live'?'Golf Ireland':'Golf summary unavailable'}</Copy><Text style={{fontSize:12,fontWeight:'700',color:theme.primaryText}}>View My Golf</Text></View>
 </Pressable>;
}
export function NativeDependantPanel(){
 const {club}=useSession(),resource=useResource<DependantsResponse>(club?'/api/dependants':null),reload=resource.reload;
 useFocusEffect(useCallback(()=>{reload();},[reload]));
 if(!club)return null;
 if(resource.error)return <Card><Copy>Dependants unavailable.</Copy><Action label="Retry dependants" secondary onPress={reload}/></Card>;
 if(resource.loading&&!resource.data)return <Copy style={{fontSize:12}}>Loading your dependants…</Copy>;
 return resource.data?<DependantCards rows={resource.data.dependants} clubId={club.id}/>:null;
}
function DependantEditor({row,onDirty}:{row:Dependant;onDirty:(id:string,dirty:boolean)=>void}){
 const {request,setClub}=useSession(),guard=useDraftGuard(),[firstName,setFirstName]=useState(row.first_name),[lastName,setLastName]=useState(row.last_name),[phone,setPhone]=useState(row.phone??''),[saved,setSaved]=useState({firstName:row.first_name,lastName:row.last_name,phone:row.phone??''}),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const dirty=firstName!==saved.firstName||lastName!==saved.lastName||phone!==saved.phone;
 useDraftRegistration(`dependant:${row.id}`,dirty);
 function change(field:'firstName'|'lastName'|'phone',value:string){const next={firstName,lastName,phone,[field]:value};if(field==='firstName')setFirstName(value);else if(field==='lastName')setLastName(value);else setPhone(value);onDirty(row.id,next.firstName!==saved.firstName||next.lastName!==saved.lastName||next.phone!==saved.phone);setMessage('');}
 async function save(){setBusy(true);setMessage('');setError('');try{const next={firstName:firstName.trim(),lastName:lastName.trim(),phone:phone.trim()};await request('/api/dependants',{clubId:row.club_id,playerId:row.player_id,...next},'PATCH');setFirstName(next.firstName);setLastName(next.lastName);setPhone(next.phone);setSaved(next);onDirty(row.id,false);setMessage('Contact details saved.');}catch(e){setError(e instanceof Error?e.message:'Could not save contact details.');}finally{setBusy(false);}}
 return <Card><Copy bold style={{fontSize:19}}>{saved.firstName} {saved.lastName}</Copy><Copy>{row.club_name} · You are their {row.relationship.toLowerCase()}</Copy><Copy>Golf Ireland number: {row.golf_ireland_number||'Contact your club administrator to complete player registration'}</Copy>
  <NativeProfilePhotoEditor name={`${saved.firstName} ${saved.lastName}`} initialImage={row.profile_image} playerId={row.player_id} clubId={row.club_id}/>
  <Input label="First name" value={firstName} editable={!busy} maxLength={100} onChangeText={v=>change('firstName',v)}/><Input label="Last name" value={lastName} editable={!busy} maxLength={100} onChangeText={v=>change('lastName',v)}/><Input label="Phone" value={phone} editable={!busy} maxLength={40} keyboardType="phone-pad" onChangeText={v=>change('phone',v)}/>
  <Status loading={busy} error={error}/>{!!message&&<Text accessibilityRole="alert">{message}</Text>}<Action label="Save contact details" disabled={busy||!dirty||!firstName.trim()||!lastName.trim()} onPress={()=>void save()}/><Action label="Book a lesson" secondary disabled={busy} onPress={()=>guard.run(()=>{setClub(row.club_id);router.navigate({pathname:'/lessons',params:{playerId:row.player_id,clubId:row.club_id,bookingIntent:String(Date.now())}});})}/>
 </Card>;
}
export function NativeDependants(){
 const resource=useResource<DependantsResponse>('/api/dependants'),guard=useDraftGuard(),[revision,setRevision]=useState(0),[dirtyRows,setDirtyRows]=useState<Record<string,boolean>>({});
 const dirty=Object.values(dirtyRows).some(Boolean);
 const refresh=()=>guard.run(()=>{setRevision(n=>n+1);setDirtyRows({});resource.reload();});
 return <Page title="My dependants" onRefresh={refresh} refreshing={resource.loading}>
  <Copy>Manage contact details and book lessons for players linked to your account by a club administrator.</Copy><Status loading={resource.loading} error={resource.error}/>{!!resource.error&&<Action label="Try again" secondary onPress={refresh}/>}
  {!resource.loading&&resource.data?.dependants.map(row=><DependantEditor key={`${row.id}:${revision}`} row={row} onDirty={(id,value)=>setDirtyRows(rows=>({...rows,[id]:value}))}/>)}
  {resource.data&&!resource.data.dependants.length&&<EmptyState icon="people-outline" title="No dependants linked" detail="Contact your club administrator to arrange access to the players in your care."/>}
  {dirty&&<Copy style={{fontSize:12}}>You have unsaved contact details.</Copy>}
 </Page>;
}
const s=StyleSheet.create({card:{gap:t.spacing.md,padding:t.spacing.lg,borderRadius:t.radius.card,borderWidth:1},player:{flexDirection:'row',alignItems:'center',gap:t.spacing.md},stats:{flexDirection:'row',gap:t.spacing.md,padding:t.spacing.md,borderRadius:t.radius.button},stat:{flex:1,gap:4},value:{fontSize:25,fontWeight:'800',fontVariant:['tabular-nums']},small:{fontSize:12,lineHeight:18},footer:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},avatar:{width:58,height:58,borderRadius:29,alignItems:'center',justifyContent:'center'},name:{fontSize:18,fontWeight:'800',flexShrink:1}});
