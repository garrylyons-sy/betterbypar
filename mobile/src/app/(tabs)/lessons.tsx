import {useSession} from '../../lib/session';
import {golfCapabilities} from '../../../../shared/golf-capabilities.mjs';
import {NativeCoachWorkspace} from '../../components/native-coach-workspace';
import {useState} from 'react';
import {useLocalSearchParams} from 'expo-router';
import {NativeLessons} from '../../components/native-lessons';
import {useDraftRegistration} from '../../lib/draft-guard';
export default function Lessons(){const {club}=useSession();return golfCapabilities(club?.roles).professional?<NativeCoachWorkspace key={club?.id} section="diary"/>:<PlayerLessons/>;}
function PlayerLessons(){const {booking,notificationRequest,playerId,clubId,bookingIntent}=useLocalSearchParams<{booking?:string|string[];notificationRequest?:string;playerId?:string;clubId?:string;bookingIntent?:string}>();const [dirty,setDirty]=useState(false);useDraftRegistration('lessons',dirty);return <NativeLessons key={bookingIntent} preferredPlayerId={playerId} preferredClubId={clubId} bookingId={typeof booking==='string'?booking:undefined} bookingRequest={notificationRequest} onDirtyChange={setDirty}/>;}
