import {requestPasswordReset} from '../lib/google-sign-in';
import {useRef,useState,type ComponentRef} from 'react';
import {ActivityIndicator,Image,KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import {Ionicons} from '@expo/vector-icons';
import {Redirect} from 'expo-router';
import {useSession} from '../lib/session';
import {buildBrandTheme,designTokens as t} from '../../../shared/design-system.mjs';
const brand=buildBrandTheme();

export function SignIn(){
 const session=useSession();
 const [identifier,setIdentifier]=useState(''),[password,setPassword]=useState(''),[origin,setOrigin]=useState(session.origin);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[visible,setVisible]=useState(false),[focused,setFocused]=useState(''),[developerOpen,setDeveloperOpen]=useState(false),[forgot,setForgot]=useState(false),[message,setMessage]=useState('');
 const passwordInput=useRef<ComponentRef<typeof TextInput>>(null),submitting=useRef(false);
 if(session.status==='ready')return <Redirect href="/"/>;
 const checking=session.status==='checking',offline=session.status==='offline';
 const disabled=busy||!identifier.trim()||(!forgot&&!password);
 async function submit(){
  if(submitting.current||!identifier.trim()||(!forgot&&!password))return;
  submitting.current=true;setBusy(true);setError('');
  try{if(forgot){const result=await requestPasswordReset(origin,identifier);setMessage(result.message??'If an account exists, you will receive a reset email.');}else{await session.signIn(identifier.trim(),password,origin);setPassword('');}}
  catch(reason){setError(reason instanceof Error?reason.message:'Could not sign in. Please try again.');}
  finally{submitting.current=false;setBusy(false);}
 }
 async function google(){if(submitting.current)return;submitting.current=true;setBusy(true);setError('');setMessage('');try{await session.signInGoogle(origin);setMessage('Continue with Google in your browser. You will return here after signing in.');}catch(reason){setError(reason instanceof Error?reason.message:'Google sign-in is unavailable.');}finally{submitting.current=false;setBusy(false);}}
 return <SafeAreaView style={s.page} edges={['top','bottom']}>
  <StatusBar style="light"/>
  <KeyboardAvoidingView style={s.fill} behavior={Platform.OS==='ios'?'padding':'height'}>
   <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <View style={s.brandRow}>
     <View style={s.logoPlate}><Image accessible accessibilityLabel="Better By Par Golf" source={require('../../assets/brand/logo.png')} resizeMode="contain" style={s.logo}/></View>
     <View style={s.inviteBadge}><Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name="lock-closed-outline" size={13} color="#BBD8F5"/><Text style={s.inviteBadgeText}>INVITE ONLY</Text></View>
    </View>
    <View style={s.hero}>
     <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.art}><View style={s.ring}/><View style={[s.ring,s.innerRing]}/><Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name="golf-outline" size={60} color="#4B8AC7" style={s.flag}/></View>
     <Text accessibilityRole="header" style={s.heroTitle}>A better game{ '\n'}<Text style={s.heroAccent}>starts here.</Text></Text>
     <Text style={s.heroCopy}>Your golf, your professional, your club.</Text>
    </View>
    <View style={s.card}>
     <View style={s.heading}>
      <Text accessibilityRole="header" style={s.title}>{checking?'Getting you ready':offline?'Let’s reconnect':forgot?'Reset your password':'Welcome back'}</Text>
      <Text style={s.subtitle}>{checking?'Connecting to your club…':offline?'Your account is saved on this device.':forgot?'We’ll email you a secure reset link.':'Sign in with your club account.'}</Text>
     </View>
     {checking?<ActivityIndicator accessibilityLabel="Checking your session" color={brand.accent} style={{paddingVertical:24}}/>:offline?<>
      <Text accessibilityRole="alert" style={s.errorText}>{error||session.error||'We couldn’t reach your club. Check your connection and try again.'}</Text>
      <Pressable accessibilityRole="button" onPress={()=>void session.retry()} style={s.primary}><Text style={s.primaryText}>Reconnect</Text><Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name="refresh-outline" size={20} color="#FFF"/></Pressable>
      <Pressable accessibilityRole="button" onPress={()=>void session.signOut().catch(reason=>setError(reason.message))} style={s.secondary}><Text style={s.secondaryText}>Sign out on this device</Text></Pressable>
     </>:<>
      {!forgot&&<><Pressable accessibilityRole="button" accessibilityLabel="Continue with Google" disabled={busy} accessibilityState={{disabled:busy}} onPress={()=>void google()} style={[s.googleButton,busy&&{opacity:.55}]}><Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name="logo-google" size={20} color={brand.primary}/><Text style={s.googleText}>Continue with Google</Text></Pressable><View style={s.divider}><View style={s.dividerLine}/><Text style={s.dividerText}>or sign in with email</Text><View style={s.dividerLine}/></View></>}
      <View style={s.field}><Text style={s.label} nativeID="login-identifier-label">Email or user ID</Text><View style={[s.inputRow,focused==='identifier'&&s.focused]}><Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name="person-outline" size={19} color={brand.muted}/><TextInput accessibilityLabel="Email or user ID" accessibilityLabelledBy="login-identifier-label" placeholder="you@example.com" placeholderTextColor="#79879A" autoCapitalize="none" autoCorrect={false} textContentType="username" autoComplete="username" returnKeyType={forgot?'send':'next'} submitBehavior="submit" onSubmitEditing={()=>forgot?void submit():passwordInput.current?.focus()} value={identifier} editable={!busy} onChangeText={value=>{setIdentifier(value);setError('');}} onFocus={()=>setFocused('identifier')} onBlur={()=>setFocused('')} selectionColor={brand.accent} style={s.input}/></View></View>
      {!forgot&&<View style={s.field}><Text style={s.label} nativeID="login-password-label">Password</Text><View style={[s.inputRow,focused==='password'&&s.focused]}><Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name="lock-closed-outline" size={19} color={brand.muted}/><TextInput ref={passwordInput} accessibilityLabel="Password" accessibilityLabelledBy="login-password-label" placeholder="Enter your password" placeholderTextColor="#79879A" secureTextEntry={!visible} textContentType="password" autoComplete="current-password" autoCapitalize="none" autoCorrect={false} returnKeyType="go" value={password} editable={!busy} onChangeText={value=>{setPassword(value);setError('');}} onFocus={()=>setFocused('password')} onBlur={()=>setFocused('')} onSubmitEditing={()=>void submit()} selectionColor={brand.accent} style={s.input}/><Pressable accessibilityRole="button" accessibilityLabel={visible?'Hide password':'Show password'} accessibilityState={{disabled:busy}} disabled={busy} onPress={()=>setVisible(value=>!value)} style={s.reveal}><Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name={visible?'eye-off-outline':'eye-outline'} size={21} color={brand.primary}/></Pressable></View></View>}
      {!forgot&&<Pressable accessibilityRole="button" onPress={()=>{setForgot(true);setError('');setMessage('');setPassword('');}} disabled={busy} style={s.forgotLink}><Text style={s.forgotText}>Forgot password?</Text></Pressable>}
      {!!message&&<Text accessibilityRole="alert" style={s.successText}>{message}</Text>}
      {!!(error||session.error)&&<View style={s.errorBox}><Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name="alert-circle-outline" size={18} color="#962B39"/><Text accessibilityRole="alert" style={[s.errorText,{flex:1}]}>{error||session.error}</Text></View>}
      <Pressable accessibilityRole="button" accessibilityLabel={busy?'Please wait':forgot?'Send reset email':'Sign in'} accessibilityState={{disabled,busy}} disabled={disabled} onPress={()=>void submit()} style={({pressed})=>[s.primary,pressed&&{backgroundColor:brand.primaryHover},disabled&&{opacity:.55}]}>{busy?<ActivityIndicator color="#FFF"/>:<><Text style={s.primaryText}>{forgot?'Send reset email':'Sign in'}</Text><Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name="arrow-forward" size={21} color="#FFF"/></>}</Pressable>
      {forgot&&<Pressable accessibilityRole="button" onPress={()=>{setForgot(false);setError('');setMessage('');}} disabled={busy} style={s.secondary}><Text style={s.secondaryText}>Return to sign in</Text></Pressable>}
      <View style={s.secureNote}><Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name="shield-checkmark-outline" size={14} color={brand.muted}/><Text style={s.secureText}>The same secure account as the website</Text></View>
      {__DEV__&&<View><Pressable accessibilityRole="button" accessibilityState={{expanded:developerOpen}} onPress={()=>setDeveloperOpen(value=>!value)} style={s.developerToggle}><Text style={s.developerText}>Development settings</Text><Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name={developerOpen?'chevron-up':'chevron-down'} size={14} color={brand.muted}/></Pressable>{developerOpen&&<TextInput accessibilityLabel="Backend URL" autoCapitalize="none" autoCorrect={false} value={origin} onChangeText={setOrigin} style={[s.input,s.developerInput]}/>}</View>}
     </>}
    </View>
    <View style={s.invitation}><View style={s.invitationIcon}><Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name="mail-open-outline" size={20} color="#8EC8FF"/></View><View style={s.invitationCopy}><Text style={s.invitationTitle}>Your invitation is the first step.</Text><Text style={s.invitationText}>Activate your account using your club’s invitation email. Need access? Contact your club administrator or professional.</Text></View></View>
    <Text style={s.footer}>BETTER BY PAR  ·  GOLF</Text>
   </ScrollView>
  </KeyboardAvoidingView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 googleButton:{minHeight:54,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,borderWidth:1,borderColor:brand.border,borderRadius:t.radius.button,backgroundColor:'#FFF'},googleText:{fontSize:15,fontWeight:'700',color:brand.primary},divider:{flexDirection:'row',alignItems:'center',gap:10},dividerLine:{height:1,backgroundColor:brand.border,flex:1},dividerText:{fontSize:11,color:brand.muted},forgotLink:{minHeight:44,alignSelf:'flex-end',justifyContent:'center',marginVertical:-8},forgotText:{fontSize:13,fontWeight:'700',color:brand.accentText},successText:{fontSize:13,lineHeight:20,color:brand.primary},
 fill:{flex:1},page:{flex:1,backgroundColor:brand.primary},content:{flexGrow:1,width:'100%',maxWidth:520,alignSelf:'center',paddingHorizontal:22,paddingTop:12,paddingBottom:20,gap:22},
 brandRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},logoPlate:{backgroundColor:'#FFF',borderRadius:t.radius.button,overflow:'hidden'},logo:{width:174,height:80},inviteBadge:{flexDirection:'row',alignItems:'center',gap:6,flexShrink:1},inviteBadgeText:{color:'#BBD8F5',fontSize:10,fontWeight:'700',letterSpacing:1},
 hero:{position:'relative',paddingVertical:4,gap:10,overflow:'hidden'},heroTitle:{fontSize:34,lineHeight:39,fontWeight:'800',letterSpacing:-1.1,color:'#FFF'},heroAccent:{color:'#8EC8FF'},heroCopy:{color:'#C0D2E5',fontSize:14,lineHeight:21},art:{position:'absolute',right:-88,top:-28,width:230,height:230,opacity:.6},ring:{position:'absolute',width:226,height:226,borderRadius:113,borderWidth:1,borderColor:'#3C6D9E',transform:[{scaleY:.65},{rotate:'-25deg'}]},innerRing:{width:180,height:180,top:23,left:23,borderRadius:90},flag:{position:'absolute',left:52,top:42},
 card:{backgroundColor:brand.surface,borderRadius:t.radius.card,padding:22,gap:18,borderTopWidth:3,borderTopColor:brand.accent,boxShadow:'0px 12px 32px #00000024'},heading:{gap:6},title:{fontSize:25,lineHeight:31,fontWeight:'800',letterSpacing:-.6,color:brand.primary},subtitle:{fontSize:14,lineHeight:20,color:brand.muted},
 field:{gap:8},label:{fontSize:13,fontWeight:'700',color:brand.primary},inputRow:{flexDirection:'row',alignItems:'center',gap:10,minHeight:54,paddingLeft:14,paddingRight:4,borderWidth:1,borderColor:'#D4DFEB',borderRadius:t.radius.button,backgroundColor:'#F6F8FC'},focused:{borderColor:brand.accent,backgroundColor:'#FFF'},input:{flex:1,minWidth:0,minHeight:52,fontSize:16,color:brand.text,paddingVertical:12,paddingHorizontal:0},reveal:{minWidth:48,minHeight:52,alignItems:'center',justifyContent:'center'},
 primary:{minHeight:54,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,padding:14,borderRadius:t.radius.button,backgroundColor:brand.primary},primaryText:{fontSize:16,fontWeight:'700',color:'#FFF'},secondary:{minHeight:48,alignItems:'center',justifyContent:'center',padding:12,borderRadius:t.radius.button,borderWidth:1,borderColor:brand.border},secondaryText:{fontSize:14,fontWeight:'700',color:brand.primary},
 errorBox:{flexDirection:'row',alignItems:'flex-start',gap:8,padding:12,borderRadius:t.radius.button,backgroundColor:'#FFF0F1'},errorText:{fontSize:13,lineHeight:20,color:'#962B39'},secureNote:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},secureText:{flexShrink:1,fontSize:11,lineHeight:16,color:brand.muted},
 invitation:{flexDirection:'row',alignItems:'flex-start',gap:12,paddingHorizontal:2},invitationIcon:{width:36,height:36,borderRadius:t.radius.button,backgroundColor:'#173A5D',alignItems:'center',justifyContent:'center'},invitationCopy:{flex:1,gap:5},invitationTitle:{fontSize:13,fontWeight:'700',color:'#FFF'},invitationText:{fontSize:12,lineHeight:19,color:'#B6CBE0'},footer:{textAlign:'center',fontSize:10,fontWeight:'700',letterSpacing:2,color:'#8AA9C8',marginTop:'auto'},developerToggle:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},developerText:{fontSize:11,color:brand.muted},developerInput:{borderWidth:1,borderColor:brand.border,borderRadius:t.radius.button,paddingHorizontal:10,fontSize:12}
});
