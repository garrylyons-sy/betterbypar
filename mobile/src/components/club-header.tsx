import {InboxBell} from './inbox-bell';
import {useState} from 'react';
import {Image,StyleSheet,Text,View} from 'react-native';
import type {NativeClub} from '../../../shared/native-contracts';
import {useTheme,designTokens as t} from '../lib/theme';

export function ClubHeader({club,origin,demo=false}:{club:NativeClub|null;origin:string;demo?:boolean}){
 const theme=useTheme(),[failed,setFailed]=useState('');
 let logo='';try{const url=new URL(club?.logoPath??'',origin);if(club?.logoPath&&(url.protocol==='https:'||url.origin===origin))logo=url.toString();}catch{}
 const initials=(club?.name??'Better By Par').split(/\s+/).filter(word=>!['golf','club'].includes(word.toLowerCase())).slice(0,2).map(word=>word[0]).join('');
 if(!club)return <View style={s.platform}><Image accessible accessibilityLabel="Better By Par Golf" source={require('../../assets/brand/logo.png')} resizeMode="contain" style={s.platformLogo}/></View>;
 return <View style={[s.banner,{backgroundColor:theme.primary,borderColor:theme.border}]}>
  <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.accent,{backgroundColor:theme.accent}]}/>
  <View style={s.identity}>
   <View style={s.crest}>{logo&&failed!==logo?<Image accessible accessibilityLabel={`${club.name} crest`} source={{uri:logo}} onError={()=>setFailed(logo)} resizeMode="contain" style={s.crestImage}/>:<Text accessibilityLabel={`${club.name} crest unavailable`} style={[s.initials,{color:theme.primaryText}]}>{initials}</Text>}</View>
   <View style={s.nameBlock}><Text style={[s.eyebrow,{color:theme.onPrimary}]}>YOUR CLUB</Text><Text accessibilityRole="header" style={[s.name,{color:theme.onPrimary}]}>{club.name}</Text>{demo&&<Text style={[s.sample,{color:theme.onPrimary}]}>Sample data</Text>}</View>
  </View>
  <View style={s.signature}><InboxBell onDark/><View style={{flex:1}}/><Text style={[s.powered,{color:theme.onPrimary}]}>Powered by</Text><View style={s.wordmark}><Image accessibilityLabel="Better By Par Golf" source={require('../../assets/brand/logo.png')} resizeMode="contain" style={s.wordmarkImage}/></View></View>
 </View>;
}
const s=StyleSheet.create({
 banner:{borderWidth:1,borderRadius:t.radius.card,overflow:'hidden'},accent:{height:4},identity:{flexDirection:'row',alignItems:'center',gap:16,padding:18},crest:{width:80,height:80,padding:8,borderRadius:t.radius.button,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},crestImage:{width:'100%',height:'100%'},initials:{fontSize:26,fontWeight:'800'},nameBlock:{flex:1,gap:6},eyebrow:{fontSize:10,fontWeight:'700',letterSpacing:1.8,opacity:.7},name:{fontSize:23,lineHeight:28,fontWeight:'800',letterSpacing:-.4},sample:{fontSize:11,opacity:.7},signature:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:8,paddingHorizontal:18,paddingBottom:12},powered:{fontSize:10,opacity:.7},wordmark:{backgroundColor:'#FFF',borderRadius:3,paddingHorizontal:4},wordmarkImage:{width:72,height:30},platform:{alignItems:'flex-start'},platformLogo:{width:130,height:54}
});
