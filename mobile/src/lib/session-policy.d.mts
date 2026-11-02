export function signOutNative(actions:{clear:()=>Promise<void>;reset:()=>void;revoke:()=>Promise<unknown>}):Promise<boolean>;
export function playersAtClub<T extends {clubId:string}>(options:T[],clubId:string):T[];
