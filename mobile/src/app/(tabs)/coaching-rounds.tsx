import {useState} from 'react';
import {Redirect,useLocalSearchParams} from 'expo-router';
import {golfCapabilities} from '../../../../shared/golf-capabilities.mjs';
import {NativeCoachingRounds} from '../../components/native-round-coaching';
import {Copy,Page} from '../../components/ui';
import {useDraftRegistration} from '../../lib/draft-guard';
import {useSession} from '../../lib/session';
export default function CoachingRounds(){
 const {club}=useSession(),params=useLocalSearchParams<{playerId?:string;roundId?:string}>(),[dirty,setDirty]=useState(false);
 useDraftRegistration('coaching-rounds',dirty);
 if(!golfCapabilities(club?.roles).professional)return <Redirect href="/"/>;
 const playerId=typeof params.playerId==='string'?params.playerId:undefined,roundId=typeof params.roundId==='string'?params.roundId:undefined;
 return <Page title="Player rounds">{club?<NativeCoachingRounds key={`${club.id}:${playerId??''}:${roundId??''}`} clubId={club.id} playerId={playerId} roundId={roundId} onDirtyChange={setDirty}/>:<Copy>Choose a club in the Club tab to review your players’ rounds.</Copy>}</Page>;
}
