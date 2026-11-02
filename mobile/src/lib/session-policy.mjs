export async function signOutNative({clear,reset,revoke}){await clear();reset();try{await revoke();return true;}catch{return false;}}
export function playersAtClub(options,clubId){return options.filter(p=>p.clubId===clubId);}
