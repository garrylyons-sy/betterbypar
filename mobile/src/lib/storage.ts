import * as SecureStore from 'expo-secure-store';
export const credentialStore={read:()=>SecureStore.getItemAsync('betterbypar.session'),write:(value:string)=>SecureStore.setItemAsync('betterbypar.session',value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY}),clear:()=>SecureStore.deleteItemAsync('betterbypar.session')};
