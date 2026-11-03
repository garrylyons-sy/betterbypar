import {Redirect} from 'expo-router';
import {useSession} from '../../lib/session';
import {golfCapabilities} from '../../../../shared/golf-capabilities.mjs';
import {NativeCoachWorkspace} from '../../components/native-coach-workspace';
export default function Groups(){const {club}=useSession();return golfCapabilities(club?.roles).professional?<NativeCoachWorkspace key={club?.id} section="groups"/>:<Redirect href="/"/>;}
