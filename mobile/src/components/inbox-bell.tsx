import {Pressable,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useNotifications} from '../lib/notifications';
import {useTheme} from '../lib/theme';
export function InboxBell({onDark=false}:{onDark?:boolean}){const {inbox}=useNotifications(),theme=useTheme();if(!inbox.eligible)return null;const color=onDark?theme.onPrimary:theme.primaryText;return <Pressable accessibilityRole="button" accessibilityLabel={`Inbox${inbox.unreadCount?', '+inbox.unreadCount+' unread':''}`} onPress={()=>router.navigate('/inbox')} style={{minHeight:44,minWidth:44,flexDirection:'row',alignItems:'center',gap:8}}><View><Ionicons name="mail-unread-outline" size={23} color={color}/>{inbox.unreadCount>0&&<View style={{position:'absolute',right:-7,top:-6,minWidth:17,height:17,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:theme.accent}}><Text style={{color:theme.onAccent,fontSize:9,fontWeight:'800'}}>{inbox.unreadCount>99?'99+':inbox.unreadCount}</Text></View>}</View><Text style={{color,fontWeight:'700',fontSize:12}}>Inbox</Text></Pressable>;}
