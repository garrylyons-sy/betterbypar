import {useCallback,useEffect,useState} from 'react';
import {Image,Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {advertImageUrl,safeAdvertLink} from '../../../shared/advert-policy.mjs';
import type {AdvertsResponse,SponsorAdvert} from '../../../shared/adverts';
import {useSession} from '../lib/session';
import {useTheme,designTokens as t} from '../lib/theme';
import {useResource} from './ui';

export function NativeSponsorBanner(){
 const {origin,request,club}=useSession(),theme=useTheme();
 const result=useResource<AdvertsResponse>(`/api/adverts?club=${encodeURIComponent(club?.id??'')}`);
 const reload=result.reload;
 useFocusEffect(useCallback(()=>{reload();},[reload]));
 const ad=result.data?.adverts[0];
 if(!ad||result.error)return null;
 return <SponsorImage key={ad.id} ad={ad} origin={origin} onOpen={()=>{
  if(!safeAdvertLink(ad.linkUrl))return;
  // Navigation must remain responsive even if analytics is unavailable.
  void request('/api/ad-click',{adId:ad.id}).catch(()=>{});
  void Linking.openURL(ad.linkUrl).catch(()=>{});
 }} border={theme.border} muted={theme.muted}/>;
}
function SponsorImage({ad,origin,onOpen,border,muted}:{ad:SponsorAdvert;origin:string;onOpen:()=>void;border:string;muted:string}){
 const uri=advertImageUrl(ad.imagePath,origin),[failed,setFailed]=useState<string|null>(null),[ratio,setRatio]=useState(3);
 useEffect(()=>{if(!uri)return;let active=true;Image.getSize(uri,(width,height)=>{if(active&&width>0&&height>0)setRatio(width/height);},()=>{if(active)setFailed(uri);});return()=>{active=false;};},[uri]);
 if(!uri||failed===uri||!safeAdvertLink(ad.linkUrl))return null;
 return <View style={s.wrap}><Text style={[s.label,{color:muted}]}>Sponsored</Text><Pressable accessibilityRole="link" accessibilityLabel={`${ad.altText||ad.name}. Visit ${ad.name}`} onPress={onOpen} style={({pressed})=>[s.link,{borderColor:border,opacity:pressed?.85:1}]}><Image source={{uri}} resizeMode="contain" style={{width:'100%',aspectRatio:ratio,minHeight:t.minTouchTarget,maxHeight:320}} onError={()=>setFailed(uri)}/></Pressable></View>;
}
const s=StyleSheet.create({wrap:{gap:t.spacing.xs},label:{fontSize:t.type.small},link:{borderRadius:t.radius.card,borderWidth:1,overflow:'hidden',minHeight:t.minTouchTarget}});
