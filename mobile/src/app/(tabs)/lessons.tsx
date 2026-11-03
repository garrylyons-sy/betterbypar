import {useState} from 'react';
import {useLocalSearchParams} from 'expo-router';
import {NativeLessons} from '../../components/native-lessons';
import {useDraftRegistration} from '../../lib/draft-guard';
export default function Lessons(){const {booking,notificationRequest}=useLocalSearchParams<{booking?:string|string[];notificationRequest?:string}>();const [dirty,setDirty]=useState(false);useDraftRegistration('lessons',dirty);return <NativeLessons bookingId={typeof booking==='string'?booking:undefined} bookingRequest={notificationRequest} onDirtyChange={setDirty}/>;}
