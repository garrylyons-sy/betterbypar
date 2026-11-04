import {useState} from 'react';
import {Image,Pressable} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useSession} from '../lib/session';
import {useTheme} from '../lib/theme';
export function ProfileButton({onDark=false}:{onDark?:boolean}){
 const {session,origin}=useSession(),theme=useTheme(),[failed,setFailed]=useState('');
 const photo=session?.user.profileImage;let uri='';
 try{if(photo){const url=new URL(photo,origin);if(url.protocol==='https:'||url.origin===origin)uri=url.href;}}catch{}
 return <Pressable accessibilityRole="button" accessibilityLabel="My profile and personal details" onPress={()=>router.navigate('/profile')} style={{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:onDark?'rgba(255,255,255,0.12)':theme.soft}}>
  {uri&&failed!==uri?<Image source={{uri}} onError={()=>setFailed(uri)} style={{width:36,height:36,borderRadius:18}}/>:<Ionicons name="person-circle-outline" size={32} color={onDark?theme.onPrimary:theme.primaryText}/>}
 </Pressable>;
}
