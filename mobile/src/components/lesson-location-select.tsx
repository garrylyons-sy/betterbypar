import {useState} from 'react';
import {Pressable,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useTheme} from '../lib/theme';
import {Copy} from './ui';

export function LessonLocationSelect({value,locations,disabled=false,onChange}:{value:string;locations:readonly {id:string;name:string}[];disabled?:boolean;onChange:(value:string)=>void}){
 const theme=useTheme(),[open,setOpen]=useState(false);
 const options=[{id:'',name:'To be confirmed'},...locations];
 const label=options.find(option=>option.id===value)?.name??'To be confirmed';
 return <View style={{gap:6}}>
  <Copy bold style={{fontSize:13,color:theme.text}}>Lesson location</Copy>
  <Pressable accessibilityRole="button" accessibilityLabel={`Lesson location: ${label}`} accessibilityHint="Choose a lesson location" accessibilityState={{expanded:open&&!disabled,disabled}} disabled={disabled} onPress={()=>{if(!disabled)setOpen(!open);}} style={{minHeight:44,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,paddingVertical:10,borderWidth:1,borderRadius:6,borderColor:theme.border,backgroundColor:theme.surface,opacity:disabled?.5:1}}>
   <Ionicons name="location-outline" size={18} color={theme.muted}/>
   <Copy style={{flex:1,fontSize:14,color:theme.text}}>{label}</Copy>
   <Ionicons name={open&&!disabled?'chevron-up':'chevron-down'} size={16} color={theme.muted}/>
  </Pressable>
  {open&&!disabled&&<View style={{borderWidth:1,borderColor:theme.border,borderRadius:6,overflow:'hidden',backgroundColor:theme.surface}}>{options.map(option=><Pressable key={option.id} accessibilityRole="button" accessibilityLabel={option.name} accessibilityState={{selected:value===option.id}} onPress={()=>{if(disabled)return;setOpen(false);onChange(option.id);}} style={{minHeight:44,paddingVertical:10,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:8,backgroundColor:value===option.id?theme.soft:theme.surface}}>
   <Copy bold={value===option.id} style={{flex:1,fontSize:14,color:theme.text}}>{option.name}</Copy>
   {value===option.id&&<Ionicons name="checkmark" size={18} color={theme.primaryText}/>}
  </Pressable>)}</View>}
 </View>;
}
