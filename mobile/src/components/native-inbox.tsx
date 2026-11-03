import {useEffect,useRef,useState} from 'react';
import {Alert,Pressable,Switch,Text,View} from 'react-native';
import {router} from 'expo-router';
import * as Linking from 'expo-linking';
import {Ionicons} from '@expo/vector-icons';
import {Page,Card,Action,Copy,Choice,Status,useResource} from './ui';
import {useNotifications} from '../lib/notifications';
import {useSession} from '../lib/session';
import {useTheme,designTokens as t} from '../lib/theme';
import {useDraftGuard,useDraftRegistration} from '../lib/draft-guard';
import {golfNotificationCategories,nativeNotificationDestination,notificationDate} from '../../../shared/notification-presentation.mjs';
import type {InboxItem,NotificationMessage,NotificationReadiness} from '../../../shared/notification-contracts';
import type {Preferences,NotificationType} from '../../../lib/notification-policy.mjs';
export function NativeInbox(){const {session,origin}=useSession();return <InboxContent key={`${origin}:${session?.user.personId}`}/>;}
function InboxContent(){
 const {inbox,loading,error,refresh,update}=useNotifications(),{request,origin,setClub,session}=useSession(),theme=useTheme(),guard=useDraftGuard();
 const [settings,setSettings]=useState(false),[unread,setUnread]=useState(false),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[actionError,setActionError]=useState(''),[draft,setDraft]=useState<Preferences|null>(null),[dirty,setDirty]=useState(false);
 const readiness=useResource<NotificationReadiness>(settings?'/api/notifications/status':null),preferences=draft??inbox.preferences;
 useDraftRegistration('notification-settings',dirty);
 const writing=useRef(false);
 async function act(work:()=>Promise<void>){if(writing.current)return;writing.current=true;setBusy(true);setActionError('');setMessage('');try{await work();}catch(e){setActionError(e instanceof Error?e.message:'Could not update the inbox.');}finally{writing.current=false;setBusy(false);}}
 function open(item:InboxItem){setSelected(current=>current===item.id?'':item.id);if(!item.readAt)void act(()=>update({id:item.id},'PATCH'));}
 function navigate(item:InboxItem){const destination=nativeNotificationDestination(item.href);guard.run(()=>{if(destination.kind==='native'){if(destination.params.clubId&&session?.clubs.some(c=>c.id===destination.params.clubId))setClub(destination.params.clubId);const intent=Date.now().toString();router.navigate({pathname:destination.pathname,params:{...destination.params,notificationRequest:intent,intent}});}else if(destination.kind==='web')void Linking.openURL(origin+destination.href).catch(()=>setActionError('Could not open this page.'));});}
 function toggle(key:'inboxTypes'|'pushTypes'|'emailTypes',type:NotificationType){if(!preferences||busy)return;setDraft({...preferences,[key]:preferences[key].includes(type)?preferences[key].filter(v=>v!==type):[...preferences[key],type]});setDirty(true);}
 function master(key:'pushEnabled'|'emailEnabled',value:boolean){if(!preferences)return;setDraft({...preferences,[key]:value});setDirty(true);}
 function leaveSettings(){if(!dirty){setSettings(false);return;}Alert.alert('Discard preference changes?','Your notification choices have not been saved.',[{text:'Keep editing',style:'cancel'},{text:'Discard',style:'destructive',onPress:()=>{setDraft(null);setDirty(false);setSettings(false);}}]);}
 const items=inbox.items.filter(item=>!unread||!item.readAt);
 return <Page title={settings?'Notification settings':'Inbox'} onRefresh={()=>void refresh()} refreshing={loading}>
  <Status loading={loading&&!inbox.items.length} error={actionError||error}/>{!!message&&<Card><Copy bold>{message}</Copy></Card>}
  {!inbox.eligible&&!loading?<Card><Copy>Notifications are unavailable for this account.</Copy><Action label="Try again" secondary onPress={()=>void refresh()}/></Card>:settings?<>
   <Copy>Choose inbox, phone push, email, or any combination for each event. Turn all three off to receive no alerts for that event.</Copy>
   <Status loading={readiness.loading} error={readiness.error}/>
   {preferences&&<><Card><Toggle label="Enable phone push" value={preferences.pushEnabled} disabled={busy} onChange={v=>master('pushEnabled',v)}/><Copy style={{fontSize:12}}>Phone alerts use the website added to your Home Screen. This app shares the inbox; phone push alerts are delivered by the Home Screen website.</Copy><Toggle label="Enable email" value={preferences.emailEnabled} disabled={busy} onChange={v=>master('emailEnabled',v)}/>{!readiness.data?.emailReady&&<Copy style={{fontSize:12}}>Email preferences can be saved now. Delivery requires the platform’s verified email sender.</Copy>}</Card>
   {golfNotificationCategories.map(category=><Card key={category.type}><Copy bold style={{color:theme.text}}>{category.label}</Copy><View style={{flexDirection:'row',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>{([{key:'inboxTypes',label:'Inbox'},{key:'pushTypes',label:'Phone push'},{key:'emailTypes',label:'Email'}] as const).map(channel=><View key={channel.key} style={{alignItems:'center',gap:4}}><Copy style={{fontSize:11}}>{channel.label}</Copy><Switch accessibilityLabel={`${category.label}: ${channel.label}`} disabled={busy} value={preferences[channel.key].includes(category.type)} onValueChange={()=>toggle(channel.key,category.type)} trackColor={{true:theme.primary}}/></View>)}</View></Card>)}
   <Action label={busy?'Saving…':'Save preferences'} disabled={busy||!dirty} onPress={()=>void act(async()=>{await request<{preferences:Preferences}>('/api/notifications/preferences',preferences,'PATCH');await refresh();setDraft(null);setDirty(false);setMessage('Notification preferences saved.');})}/></>}
   <Card><Copy bold>Set up phone alerts</Copy><Copy>On your iPhone, open Better By Par in Safari, use Share → Add to Home Screen, then open that icon. In Inbox settings, choose Enable on this device and allow notifications.</Copy><Copy style={{fontSize:12}}>{readiness.data?.webPushReady?'Web push is configured. Each device needs its own permission.':'Web push setup is still being checked. Your inbox works independently.'}</Copy><Action label="Open website notification setup" secondary onPress={()=>void Linking.openURL(origin+'/?notifications=1&notificationSettings=1').catch(()=>setActionError('Could not open the website.'))}/></Card>
   <Action label="Return to inbox" secondary disabled={busy} onPress={leaveSettings}/>
  </>:<>
   <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}><Choice label="All" selected={!unread} onPress={()=>setUnread(false)}/><Choice label={`Unread (${inbox.unreadCount})`} selected={unread} onPress={()=>setUnread(true)}/><Action secondary label="Settings" onPress={()=>{setSettings(true);setMessage('');}}/></View>
   <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}><Action secondary label="Mark all read" disabled={busy||!inbox.unreadCount} onPress={()=>void act(()=>update({all:true},'PATCH'))}/><Action secondary label="Remove read" disabled={busy||!inbox.items.some(n=>n.readAt)} onPress={()=>Alert.alert('Remove read notifications?','Read items will be removed from your inbox.',[{text:'Keep',style:'cancel'},{text:'Remove',onPress:()=>void act(()=>update({allRead:true},'DELETE'))}])}/></View>
   {!items.length&&!loading&&<Card><Copy bold>{unread?'You’re all caught up':'Your inbox is clear'}</Copy><Copy>Lesson updates, reminders, coaching notes and club announcements will appear here according to your preferences.</Copy></Card>}
   {items.map(item=><Card key={item.id}><Pressable accessibilityRole="button" accessibilityState={{expanded:selected===item.id}} onPress={()=>open(item)} style={{gap:8,minHeight:60}}><View style={{flexDirection:'row',gap:10,alignItems:'center'}}><Ionicons name={item.readAt?'mail-open-outline':'mail-unread-outline'} size={23} color={theme.primaryText}/><View style={{flex:1,gap:4}}><Text style={{fontSize:16,fontWeight:item.readAt?'600':'800',color:theme.text}}>{item.title}</Text><Copy style={{fontSize:11}}>{notificationDate(item.createdAt)}{item.readAt?'':' · Unread'}</Copy></View><Ionicons name={selected===item.id?'chevron-up':'chevron-down'} size={17} color={theme.muted}/></View><Text numberOfLines={selected===item.id?undefined:2} style={{fontSize:13,lineHeight:20,color:theme.muted}}>{item.body}</Text></Pressable>{selected===item.id&&<>{nativeNotificationDestination(item.href).kind==='message'?<Announcement item={item} onRead={refresh}/>:<Action label={nativeNotificationDestination(item.href).kind==='web'?'Open on website':'Open details'} secondary disabled={busy} onPress={()=>navigate(item)}/>}<Action label="Remove from inbox" secondary disabled={busy} onPress={()=>void act(async()=>{await update({id:item.id},'DELETE');setSelected('');})}/></>}</Card>)}
  </>}
 </Page>;
}
function Toggle({label,value,onChange,disabled}:{label:string;value:boolean;onChange:(value:boolean)=>void;disabled:boolean}){const theme=useTheme();return <View style={{flexDirection:'row',gap:12,alignItems:'center',justifyContent:'space-between',minHeight:t.minTouchTarget}}><Copy bold>{label}</Copy><Switch accessibilityLabel={label} disabled={disabled} value={value} onValueChange={onChange} trackColor={{true:theme.primary}}/></View>;}
function Announcement({item,onRead}:{item:InboxItem;onRead:()=>Promise<void>}){
 const destination=nativeNotificationDestination(item.href),id=destination.kind==='message'?destination.id:'',result=useResource<{message:NotificationMessage}>(id?`/api/notifications/message?id=${id}`:null),{request}=useSession(),[receiptError,setReceiptError]=useState('');
 useEffect(()=>{if(!result.data)return;let active=true;void request(`/api/notifications/message?id=${id}`,{}).then(()=>{if(active)void onRead();}).catch(()=>{if(active)setReceiptError('Could not save the opened receipt.');});return()=>{active=false;};},[id,result.data,request,onRead]);
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const expired=result.data&&Date.parse(result.data.message.availableUntil)<=now;
 return <View style={{gap:10}}><Status loading={result.loading} error={result.error||receiptError}/>{result.data&&!expired&&<Copy>{result.data.message.body}</Copy>}{expired&&<Copy>This message has expired.</Copy>}{!!result.error&&<Action label="Retry message" secondary onPress={result.reload}/>}</View>;
}
