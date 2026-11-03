import {NativeProShop} from '../../components/native-pro-shop';
import {useSession} from '../../lib/session';
export default function ProShop(){const {club}=useSession();return <NativeProShop key={club?.id}/>;}
