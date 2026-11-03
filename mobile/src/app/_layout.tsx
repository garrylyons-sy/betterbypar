import {DraftGuardProvider} from '../lib/draft-guard';
import {Stack} from 'expo-router';import {StatusBar} from 'expo-status-bar';import {SafeAreaProvider} from 'react-native-safe-area-context';import {SessionProvider} from '../lib/session';
export default function RootLayout(){return <SafeAreaProvider><DraftGuardProvider><SessionProvider><StatusBar style="dark"/><Stack screenOptions={{headerShown:false}}/></SessionProvider></DraftGuardProvider></SafeAreaProvider>;}
