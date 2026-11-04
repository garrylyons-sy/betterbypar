import {createContext,useContext,useCallback,useEffect,useRef,useState,type ReactNode,type ComponentRef} from 'react';
import {ActivityIndicator,KeyboardAvoidingView,Platform,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View,type TextStyle} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {buildBrandTheme} from '../../../shared/design-system.mjs';
import {useTheme,designTokens as t} from '../lib/theme';
import {useSession} from '../lib/session';
import {ClubHeader} from './club-header';
const defaults=buildBrandTheme();
export const colors={navy:defaults.primary,blue:defaults.accent,page:defaults.page,muted:defaults.muted,border:defaults.border};
export function Title({children}:{children:ReactNode}){const theme=useTheme();return <Text accessibilityRole="header" style={[styles.title,{color:theme.text}]}>{children}</Text>;}
export function Copy({children,bold=false,style}:{children:ReactNode;bold?:boolean;style?:TextStyle}){const theme=useTheme();return <Text style={[styles.copy,{color:theme.muted},bold&&{fontWeight:'700'},style]}>{children}</Text>;}
export function Card({children,dark=false}:{children:ReactNode;dark?:boolean}){const theme=useTheme();return <View style={[styles.card,{backgroundColor:dark?theme.primary:theme.surface,borderColor:theme.border,borderTopColor:dark?theme.accent:theme.border,borderTopWidth:dark?3:1,boxShadow:`0px 4px 14px ${theme.primary}0D`}]}>{children}</View>;}
export function Action({label,onPress,disabled=false,secondary=false}:{label:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}){const theme=useTheme();return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>[styles.action,{backgroundColor:secondary?theme.soft:pressed?theme.primaryHover:theme.primary},disabled&&{opacity:.45}]}><Text style={{color:secondary?theme.text:theme.onPrimary,fontWeight:'700',textAlign:'center'}}>{label}</Text></Pressable>;}
const PageScrollContext=createContext<(()=>void)|null>(null);
export function usePageScrollToTop(){return useContext(PageScrollContext);}
export function Page({title,children,onRefresh,refreshing=false,showProfile=false}:{title:string;children:ReactNode;showProfile?:boolean;onRefresh?:()=>void;refreshing?:boolean}){
 const {club,session,origin}=useSession(),theme=useTheme(),scrollRef=useRef<ComponentRef<typeof ScrollView>>(null);
 const scrollToTop=useCallback(()=>scrollRef.current?.scrollTo({y:0,animated:true}),[]);
 return <PageScrollContext.Provider value={scrollToTop}><SafeAreaView style={[styles.page,{backgroundColor:theme.page}]} edges={['top']}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={onRefresh?<RefreshControl tintColor={theme.primary} colors={[theme.primary]} refreshing={refreshing} onRefresh={onRefresh}/>:undefined}>
 <ClubHeader club={club} origin={origin} demo={session?.demo} showProfile={showProfile}/>
 <Title>{title}</Title>{children}</ScrollView></KeyboardAvoidingView></SafeAreaView></PageScrollContext.Provider>;
}
export function useResource<T>(path:string|null){
 const {request}=useSession(),[result,setResult]=useState<{path:string|null;tick:number;data:T|null;error:string}>({path:null,tick:-1,data:null,error:''}),[tick,setTick]=useState(0),version=useRef(0);
 const reload=useCallback(()=>setTick(t=>t+1),[]);
 useEffect(()=>{const generation=++version.current;if(!path)return;let active=true;void request<T>(path).then(data=>{if(active&&version.current===generation)setResult({path,tick,data,error:''});}).catch(e=>{if(active&&version.current===generation)setResult({path,tick,data:null,error:e.message});});return()=>{active=false;};},[path,request,tick]);
 return {data:result.path===path?result.data:null,error:result.path===path?result.error:'',loading:!!path&&(result.path!==path||result.tick!==tick),reload};
}

export function Status({loading,error}:{loading:boolean;error:string}){const theme=useTheme();return <>{loading&&<ActivityIndicator accessibilityLabel="Loading" color={theme.primaryText}/ >}{!!error&&<Text accessibilityRole="alert" style={{color:theme.text}}>{error}</Text>}</>;}
export function Choice({label,selected,onPress}:{label:string;selected:boolean;onPress:()=>void}){const theme=useTheme();return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={[styles.choice,{borderColor:selected?theme.primaryText:theme.border,backgroundColor:selected?theme.soft:theme.surface}]}><Text style={[styles.copy,{color:theme.text,fontWeight:selected?'700':'500'}]}>{label}</Text></Pressable>;}
export const styles=StyleSheet.create({
 page:{flex:1},content:{padding:t.spacing.lg,gap:t.spacing.lg,paddingBottom:32,width:'100%',maxWidth:720,alignSelf:'center'},brandRow:{flexDirection:'row',alignItems:'center',gap:t.spacing.md},
 title:{fontSize:t.type.title,fontWeight:'800',letterSpacing:-.7,color:defaults.text},copy:{fontSize:t.type.body,lineHeight:23,color:defaults.muted},
 card:{padding:t.spacing.xl,borderRadius:t.radius.card,gap:t.spacing.md,borderWidth:1},action:{minHeight:t.minTouchTarget,padding:14,borderRadius:t.radius.button,justifyContent:'center'},
 choice:{minHeight:t.minTouchTarget,padding:t.spacing.md,borderWidth:1,borderRadius:t.radius.button},
 input:{minHeight:t.minTouchTarget,borderWidth:1,borderColor:defaults.border,borderRadius:t.radius.button,padding:13,fontSize:16,backgroundColor:defaults.surface,color:defaults.text}
});
