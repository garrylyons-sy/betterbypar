import {useEffect,useRef,useState} from 'react';
import {Redirect,useLocalSearchParams,router} from 'expo-router';
import {Action,Card,Copy,Page,Status} from '../components/ui';
import {useSession} from '../lib/session';
export default function AuthReturn(){
 const session=useSession(),params=useLocalSearchParams<{attempt?:string;code?:string;error?:string}>(),started=useRef(false),[error,setError]=useState(''),[finished,setFinished]=useState(false);
 useEffect(()=>{if(started.current)return;started.current=true;void session.finishGoogle(typeof params.attempt==='string'?params.attempt:'',typeof params.code==='string'?params.code:'',typeof params.error==='string'?params.error:'').then(()=>setFinished(true)).catch(reason=>setError(reason instanceof Error?reason.message:'Could not complete Google sign-in.'));},[params.attempt,params.code,params.error,session]);
 if(finished&&session.status==='ready')return <Redirect href="/"/>;
 return <Page title={error?'Google sign-in':'Welcome to Better By Par'}><Card><Status loading={!error} error={error}/><Copy>{error?'Return to sign in and try again. Use the Google account linked to your club invitation.':'Finishing your secure Google sign-in…'}</Copy>{!!error&&<Action label="Return to sign in" onPress={()=>router.replace('/sign-in')}/>}</Card></Page>;
}
