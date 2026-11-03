import {useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {dateLabel,golfSummaryView,indexLabel,countingLabel,countingSignalColours,type TrendPoint} from '../../../shared/golf-presentation.mjs';
import type {GolfSummary} from '../../../shared/golf-summary';
import {useTheme,designTokens as t} from '../lib/theme';

export function GolfOverview({summary}:{summary:GolfSummary}){
 const theme=useTheme(),[details,setDetails]=useState(false);
 const {handicap,rounds,movement,movementLabel,hasUnknownCounting,trend}=golfSummaryView(summary);
 return <View style={[s.overview,{backgroundColor:theme.soft,borderColor:theme.border}]}>
  <View style={s.sectionHeading}><Text accessibilityRole="header" style={[s.sectionTitle,{color:theme.text}]}>Your golf</Text>{summary.mode==='demo'&&<Text style={[s.badge,{color:theme.primaryText,borderColor:theme.border}]}>SAMPLE DATA</Text>}</View>
  <View style={[s.hero,{backgroundColor:theme.primary,borderTopWidth:3,borderTopColor:theme.accent}]}>
   <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position:'absolute',right:-50,top:-70,width:230,height:230,borderRadius:115,backgroundColor:theme.primaryLift,opacity:.38}}/>
   <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.orbit,{borderColor:theme.onPrimary}]}/>
   <View style={s.row}><View style={{flex:1,gap:3}}><Text style={[s.player,{color:theme.onPrimary}]}>{summary.player.name}</Text><Text style={[s.small,{color:theme.onPrimary,opacity:.8}]}>{summary.player.homeClub}</Text></View><Ionicons name="flag-outline" color={theme.onPrimary} size={22}/></View>
   <View style={[s.row,{alignItems:'flex-end',marginTop:t.spacing.xl}]}>
    <View style={{flex:1}}><Text style={[s.label,{color:theme.onPrimary}]}>HANDICAP INDEX</Text><Text accessibilityLabel={`Handicap Index: ${handicap==='—'?'Not available':handicap}`} style={[s.index,{color:theme.onPrimary},handicap.length>5&&{fontSize:32}]}>{handicap}</Text>{summary.handicapStatus!=='active'&&<Text style={[s.small,{color:theme.onPrimary,textTransform:'capitalize'}]}>{summary.handicapStatus}</Text>}</View>
    {summary.lowHandicapIndex!=null&&<View style={[s.low,{borderColor:theme.onPrimary}]}><Text style={[s.label,{color:theme.onPrimary}]}>LOW INDEX</Text><Text style={[s.lowValue,{color:theme.onPrimary}]}>{indexLabel(summary.lowHandicapIndex)}</Text></View>}
   </View>
   {movementLabel&&<View style={[s.row,{marginTop:t.spacing.md,justifyContent:'flex-start',gap:5}]}>{movement!==0&&<Ionicons name={movement!>0?'trending-down-outline':'trending-up-outline'} color={theme.onPrimary} size={18}/>}<Text style={[s.small,{color:theme.onPrimary,fontWeight:'700'}]}>{movementLabel} <Text style={{fontWeight:'400',opacity:.8}}>since last round</Text></Text></View>}
   {trend.length>1&&<IndexTrend points={trend}/>}
  </View>
  <View style={s.rounds}>
   <View style={s.sectionHeading}><Text accessibilityRole="header" style={[s.sectionTitle,{color:theme.text}]}>Recent rounds</Text><Text style={[s.small,{color:theme.muted}]}>Last {rounds.length||3}</Text></View>
   {rounds.length?rounds.map(round=><View key={round.id} style={[s.round,{backgroundColor:theme.surface,borderColor:theme.border}]}>
    <View style={[s.score,{backgroundColor:theme.accentSoft}]}><Text style={[s.label,{color:theme.accentText}]}>GROSS</Text><Text style={[s.scoreValue,{color:theme.accentText}]}>{round.grossScore??'—'}</Text></View>
    <View style={{flex:1,gap:4}}><Text style={[s.course,{color:theme.text}]}>{round.courseName||'Course unavailable'}</Text><Text style={[s.meta,{color:theme.muted}]}>{dateLabel(round.date,true)}{round.holes?` · ${round.holes} holes`:''}{round.teeName?` · ${round.teeName}`:''}</Text><View style={[s.row,{justifyContent:'flex-start',gap:14,flexWrap:'wrap'}]}><RoundStat label="Differential" value={round.scoreDifferential?.toFixed(1)??'—'}/>{round.stablefordPoints!=null&&<RoundStat label="Points" value={String(round.stablefordPoints)}/>}</View></View>
    <CountingIcon counting={round.counting}/>
   </View>):<Text style={[s.empty,{color:theme.muted,borderColor:theme.border}]}>No recent rounds available.</Text>}
   {rounds.length>0&&<View accessibilityLabel="Handicap counting legend" style={s.legend}>{[true,false,...(hasUnknownCounting?[null]:[])].map((value,i)=><View style={[s.row,{gap:4}]} key={i}><CountingIcon counting={value} compact/><Text style={[s.meta,{color:theme.muted}]}>{value===true?'Counting':value===false?'Not counting':'Unknown'}</Text></View>)}</View>}
  </View>
  <Pressable accessibilityRole="button" accessibilityState={{expanded:details}} accessibilityLabel="Golf data details" onPress={()=>setDetails(v=>!v)} style={[s.detailsToggle,{borderColor:theme.border}]}><Text style={[s.small,{color:theme.muted,fontWeight:'600'}]}>Data details{summary.mode==='demo'?' · demo':''}</Text><Ionicons name={details?'chevron-up':'chevron-down'} color={theme.muted} size={16}/></Pressable>
  {details&&<View style={s.details}><Text style={[s.small,{color:theme.text}]}>Golf Ireland number: {summary.player.golfIrelandNumber||'Not available'}</Text><Text style={[s.small,{color:theme.muted}]}>{summary.lastUpdatedAt?`Data as of ${dateLabel(summary.lastUpdatedAt)}`:'Update date unavailable'}</Text>{summary.notice&&<Text style={[s.small,{color:theme.muted}]}>{summary.notice}</Text>}</View>}
 </View>;
}
function RoundStat({label,value}:{label:string;value:string}){const theme=useTheme();return <Text style={[s.meta,{color:theme.muted}]}>{label} <Text style={{fontWeight:'800',color:theme.text}}>{value}</Text></Text>;}
function CountingIcon({counting,compact=false}:{counting:boolean|null;compact?:boolean}){
 const active=counting===true?2:counting===false?0:1,colour=counting===true?countingSignalColours.green:counting===false?countingSignalColours.red:countingSignalColours.unknown;
 return <View accessible accessibilityRole="image" accessibilityLabel={countingLabel(counting)} style={{width:compact?13:28,height:compact?25:54,alignItems:'center',justifyContent:'center'}}><View style={{width:28,height:54,alignItems:'center',transform:[{scale:compact?.46:1}]}}>
  <View style={{width:25,height:50,borderRadius:8,borderWidth:1.7,borderColor:countingSignalColours.housing,alignItems:'center',justifyContent:'space-around',paddingVertical:2}}>
   {[0,1,2].map(i=><View key={i} style={{width:14,height:14,borderRadius:7,backgroundColor:i===active?`${colour}29`:'transparent',alignItems:'center',justifyContent:'center'}}><View style={{width:12,height:12,borderRadius:6,borderWidth:1.4,borderColor:i===active?colour:countingSignalColours.unknown,opacity:i===active?1:.5,backgroundColor:i===active?colour:'transparent'}}>{i===active&&<View style={{position:'absolute',top:1,left:1,width:2,height:2,borderRadius:1,backgroundColor:'#FFFFFF',opacity:.65}}/>}</View></View>)}
  </View><View style={{width:2,height:3,backgroundColor:countingSignalColours.housing}}/><View style={{width:8,height:1.7,borderRadius:1,backgroundColor:countingSignalColours.housing}}/>
 </View></View>;
}

function IndexTrend({points}:{points:TrendPoint[]}){
 const theme=useTheme(),[width,setWidth]=useState(280),first=points[0],last=points[points.length-1];
 return <View style={[s.trend,{borderColor:theme.onPrimary}]}>
  <View style={s.row}><Text style={[s.small,{color:theme.onPrimary,fontWeight:'700'}]}>Index trend</Text><Text style={[s.small,{color:theme.onPrimary}]}>{indexLabel(first.index)} → {indexLabel(last.index)}</Text></View>
  <View onLayout={event=>setWidth(event.nativeEvent.layout.width)} accessibilityRole="image" accessibilityLabel={`Recent index history from ${indexLabel(first.index)} on ${dateLabel(first.date)} to ${indexLabel(last.index)} on ${dateLabel(last.date)}. Lower is better.`} style={{height:64,marginTop:8}}>
   {points.slice(1).map((p,i)=>{const a=points[i],x=a.x/320*width,y=a.y,dx=(p.x-a.x)/320*width,dy=p.y-a.y,length=Math.hypot(dx,dy);return <View key={i} style={{position:'absolute',left:x+(dx-length)/2,top:y+dy/2,height:2.5,width:length,backgroundColor:theme.onPrimary,transform:[{rotate:`${Math.atan2(dy,dx)}rad`}]}}/>;})}
   {points.map((p,i)=><View key={i} style={{position:'absolute',left:p.x/320*width-3,top:p.y-3,width:6,height:6,borderRadius:3,backgroundColor:theme.onPrimary}}/>)}
  </View>
  <View style={s.row}><Text style={[s.meta,{color:theme.onPrimary}]}>{dateLabel(first.date,true)}</Text><Text style={[s.meta,{color:theme.onPrimary}]}>{dateLabel(last.date,true)}</Text></View>
 </View>;
}
const s=StyleSheet.create({
 overview:{borderWidth:1,borderRadius:t.radius.card,overflow:'hidden'},sectionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,paddingVertical:14,paddingHorizontal:16},sectionTitle:{fontSize:t.type.section,fontWeight:'800'},badge:{fontSize:9,fontWeight:'800',letterSpacing:.5,borderWidth:1,borderRadius:t.radius.pill,paddingVertical:4,paddingHorizontal:8},
 hero:{marginHorizontal:12,padding:t.spacing.xl,borderRadius:t.radius.hero,overflow:'hidden'},orbit:{position:'absolute',width:230,height:230,borderWidth:28,borderRadius:115,right:-110,top:-12,opacity:.06},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},player:{fontSize:t.type.body,fontWeight:'700'},small:{fontSize:t.type.small,lineHeight:18},label:{fontSize:t.type.caption,fontWeight:'700',letterSpacing:.9,opacity:.8},index:{fontSize:t.type.index,lineHeight:66,fontWeight:'800',letterSpacing:-3,fontVariant:['tabular-nums']},low:{paddingLeft:18,borderLeftWidth:1,paddingBottom:4},lowValue:{fontSize:t.type.lowIndex,fontWeight:'700',marginTop:4,fontVariant:['tabular-nums']},trend:{marginTop:16,paddingTop:12,borderTopWidth:StyleSheet.hairlineWidth},
 rounds:{padding:12,gap:10},round:{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderWidth:1,borderRadius:t.radius.button},score:{alignSelf:'stretch',justifyContent:'center',alignItems:'center',width:55,minHeight:76,borderRadius:t.radius.small,gap:4},scoreValue:{fontSize:t.type.score,fontWeight:'800',fontVariant:['tabular-nums']},course:{fontSize:14,fontWeight:'800'},meta:{fontSize:10,lineHeight:16},legend:{flexDirection:'row',gap:8,flexWrap:'wrap',paddingHorizontal:4,paddingTop:0},empty:{padding:20,borderWidth:1,borderStyle:'dashed',borderRadius:t.radius.button,fontSize:13},detailsToggle:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:t.minTouchTarget,paddingHorizontal:16,borderTopWidth:1},details:{padding:16,paddingTop:0,gap:8}
});
