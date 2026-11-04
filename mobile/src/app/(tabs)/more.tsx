import {golfCapabilities} from '../../../../shared/golf-capabilities.mjs';
import {router} from 'expo-router';
import {useState} from 'react';
import * as Linking from 'expo-linking';
import {Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Action,Card,Copy,Page,Status} from '../../components/ui';
import {MenuCard} from '../../components/menu-card';
import {useSession} from '../../lib/session';
import {useTheme} from '../../lib/theme';
export default function More(){
 const {session,club,setClub,origin,signOut}=useSession(),theme=useTheme(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function logout(){setBusy(true);setError('');try{await signOut();}catch(e){setError(e instanceof Error?e.message:'Could not sign out.');}finally{setBusy(false);}}
 function openWebsite(path:string){setError('');void Linking.openURL(origin+path).catch(()=>setError('Could not open the website. Please try again.'));}
 return <Page title="More">
  <Card><View style={{flexDirection:'row',alignItems:'center',gap:12}}><View style={{width:44,height:44,borderRadius:8,backgroundColor:theme.soft,alignItems:'center',justifyContent:'center'}}><Ionicons name="person-circle-outline" size={30} color={theme.primaryText}/></View><View style={{flex:1,gap:3}}><Copy bold style={{color:theme.text}}>{session?.user.name}</Copy><Copy style={{fontSize:12}}>{session?.user.email}</Copy></View></View></Card>
  {session?.canSwitchClub&&(session.clubs.length??0)>1&&<Card><Copy bold>Current club</Copy>{session?.clubs.map(c=><Action key={c.id} secondary label={`${c.name}${c.id===club?.id?' · selected':''}`} disabled={busy} onPress={()=>setClub(c.id)}/>)}</Card>}
  <View style={{gap:10}}>
   <Text accessibilityRole="header" style={{fontSize:12,fontWeight:'800',letterSpacing:1,color:theme.muted}}>YOUR CLUB & CONNECTIONS</Text>
   <MenuCard title="Pro shop" description="Equipment, essentials and gifts from your club." icon="bag-handle-outline" accent disabled={busy} onPress={()=>router.navigate('/pro-shop')}/>
   {golfCapabilities(club?.roles).professional&&<MenuCard title="Player rounds" description="Review scorecards and discuss progress with your players." icon="golf-outline" disabled={busy} onPress={()=>router.navigate('/coaching-rounds')}/>}
   <MenuCard title="Inbox & notifications" description="Your messages, updates and notification preferences." icon="mail-unread-outline" disabled={busy} onPress={()=>router.navigate('/inbox')}/>
  </View>
  <View style={{gap:10}}>
   <Text accessibilityRole="header" style={{fontSize:12,fontWeight:'800',letterSpacing:1,color:theme.muted}}>YOUR ACCOUNT</Text>
   {!golfCapabilities(club?.roles).professional&&<>
    <MenuCard title="My dependants" description="Manage the junior players in your care." icon="people-outline" disabled={busy} onPress={()=>router.navigate('/family')}/>
    <MenuCard title="Second-hand clubs" description="Discover pre-owned clubs. Values are pro shop credit." icon="golf-outline" badge="Coming soon" accent disabled={busy} onPress={()=>openWebsite('/second-hand-clubs')}/>
   </>}
  </View>
  <Status loading={busy} error={error}/><Action label="Sign out of this app" disabled={busy} onPress={()=>void logout()}/>
 </Page>;
}
