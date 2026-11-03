import {useEffect,useRef,useState} from 'react';
import {Image,Text,View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {ImageManipulator,SaveFormat} from 'expo-image-manipulator';
import type {NativeProfile as NativeProfileData} from '../../../shared/native-contracts';
import {useDraftRegistration} from '../lib/draft-guard';
import {profilePhotoResize,validateProfilePhotoAsset} from '../lib/profile-photo-policy.mjs';
import {useSession} from '../lib/session';
import {useTheme} from '../lib/theme';
import {Action,Card,Copy,Page,Status,useResource} from './ui';

async function preparePhoto(asset:ImagePicker.ImagePickerAsset){
 validateProfilePhotoAsset(asset);
 const context=ImageManipulator.manipulate(asset.uri),resize=profilePhotoResize(asset.width,asset.height);
 try{
  if(resize)context.resize(resize);
  const rendered=await context.renderAsync();
  try{return (await rendered.saveAsync({format:SaveFormat.JPEG,compress:.8})).uri;}
  finally{rendered.release();}
 }finally{context.release();}
}

type PhotoProps={name:string;initialImage?:string|null;playerId?:string;clubId?:string;onChange?:(image:string|null)=>void};
export function NativeProfilePhotoEditor({name,initialImage,playerId,clubId,onChange}:PhotoProps){
 const {request,refreshSession}=useSession(),theme=useTheme();
 const [savedPhoto,setSavedPhoto]=useState<{source:string|null|undefined;image:string}|null>(null),[selection,setSelection]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failedImage,setFailedImage]=useState('');
 const working=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const photo=savedPhoto&&savedPhoto.source===initialImage?savedPhoto.image:initialImage??'';
 useDraftRegistration(`profile-photo:${playerId??'self'}`,!!selection||busy);
 useEffect(()=>{
  let active=true,ownsWork=false;
  // Recover a selection when Android recreated the activity while its picker was open.
  void ImagePicker.getPendingResultAsync().then(async result=>{
   if(!active||!result||working.current)return;
   if('code' in result)throw new Error(result.message||'The photo selection could not be recovered.');
   if(result.canceled)return;
   ownsWork=true;working.current=true;setBusy(true);
   const uri=await preparePhoto(result.assets[0]);if(active)setSelection(uri);
  }).catch(error=>{if(active)setMessage(error instanceof Error?error.message:'Choose your photo again.');}).finally(()=>{if(ownsWork){working.current=false;if(active)setBusy(false);}});
  return()=>{active=false;};
 },[]);
 async function choose(){
  if(working.current)return;working.current=true;setBusy(true);setMessage('');
  try{const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:false,quality:1,exif:false});if(!result.canceled){const uri=await preparePhoto(result.assets[0]);if(mounted.current)setSelection(uri);}}
  catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:'This photo could not be opened. Choose another image.');}
  finally{working.current=false;if(mounted.current)setBusy(false);}
 }
 async function persist(remove=false){
  if(working.current||(!remove&&!selection))return;working.current=true;setBusy(true);setMessage('');
  try{
   const target={...(playerId?{playerId}:{}),...(clubId?{clubId}:{})};
   let body:FormData|typeof target=target;
   if(!remove){
    const form=new FormData();
    // React Native uploads a local URI directly; fetch supplies the multipart boundary.
    form.append('photo',{uri:selection,name:'profile-photo.jpg',type:'image/jpeg'} as unknown as Blob);
    if(playerId)form.append('playerId',playerId);if(clubId)form.append('clubId',clubId);body=form;
   }
   const saved=await request<{profileImage:string|null}>('/api/profile/photo',body,remove?'DELETE':'POST');
   if(!mounted.current)return;
   setSavedPhoto({source:initialImage,image:saved.profileImage??''});setSelection('');onChange?.(saved.profileImage);
   setMessage(remove?'Profile photo removed.':'Profile photo saved.');
   if(!playerId)void refreshSession().catch(()=>{if(mounted.current)setMessage('Photo saved. Your account photo will refresh when you reconnect.');});
  }catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:'The photo could not be saved.');}
  finally{working.current=false;if(mounted.current)setBusy(false);}
 }
 const uri=selection||photo,initials=name.trim().split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase()||'?';
 return <Card><Copy bold>Profile photo</Copy><View style={{alignItems:'center',gap:12}}>{uri&&failedImage!==uri?<Image accessibilityLabel={`${name}'s profile photo${selection?' preview':''}`} source={{uri}} onError={()=>setFailedImage(uri)} style={{width:112,height:112,borderRadius:56,backgroundColor:theme.soft}}/>:<View accessibilityLabel={`${name}'s initials`} style={{width:112,height:112,borderRadius:56,backgroundColor:theme.soft,alignItems:'center',justifyContent:'center'}}><Text style={{color:theme.text,fontSize:30,fontWeight:'800'}}>{initials}</Text></View>}</View>
  <Copy>Photos are resized and compressed for mobile. Your full-size original is not stored.</Copy>
  <Copy>Choose a still photo up to 20 MB. Saved at up to 512 pixels and 150 KB.</Copy>
  <Action label="Choose photo" onPress={()=>void choose()} disabled={busy} secondary/>
  {!!selection&&<><Copy bold>Preview — save to use this photo.</Copy><Action label="Save photo" onPress={()=>void persist()} disabled={busy}/><Action label="Discard selection" secondary onPress={()=>{setSelection('');setMessage('');}} disabled={busy}/></>}
  {!!photo&&<Action label="Remove photo" secondary onPress={()=>void persist(true)} disabled={busy}/>}
  {busy&&<Copy>Processing photo…</Copy>}{!!message&&<Text accessibilityLiveRegion="polite" style={{color:theme.text}}>{message}</Text>}
 </Card>;
}
export function NativeProfile(){
 const {session}=useSession(),profile=useResource<NativeProfileData>('/api/profile/photo');
 return <Page title="My profile" onRefresh={profile.reload} refreshing={profile.loading}>
  <Status loading={profile.loading} error={profile.error}/>
  {!!profile.error&&<Action label="Retry profile" onPress={profile.reload} secondary/>}
  {profile.data&&<><Card><Copy bold>{profile.data.name}</Copy>{!!session?.user.email&&<Copy>{session.user.email}</Copy>}{profile.data.isGolfPlayer&&<Copy>Golf Ireland number: {profile.data.golfIrelandNumber||'Not provided'}</Copy>}{profile.data.coaching&&<Copy>Professional account · non-player</Copy>}</Card><NativeProfilePhotoEditor name={profile.data.name} initialImage={profile.data.profileImage}/></>}
 </Page>;
}
