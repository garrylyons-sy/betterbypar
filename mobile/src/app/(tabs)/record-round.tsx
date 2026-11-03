import {useState} from 'react';
import {useLocalSearchParams} from 'expo-router';
import {Page,Copy} from '../../components/ui';
import {NativeRoundsPanel} from '../../components/native-rounds';
import {useSession} from '../../lib/session';
import {useDraftRegistration} from '../../lib/draft-guard';
export default function RecordRound(){
 const {club}=useSession(),params=useLocalSearchParams<{request?:string}>(),[dirty,setDirty]=useState(false);
 useDraftRegistration('record-round',dirty);
 return <Page title="Record a round">{club?<NativeRoundsPanel key={club.id} clubId={club.id} startNew newRequest={params.request} onDirtyChange={setDirty}/>:<Copy>Choose a club in the Club tab to record your round.</Copy>}</Page>;
}
