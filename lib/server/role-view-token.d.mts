export type RoleViewToken={personId:string;clubId:string;role:string;expiresAt:number};
export function signRoleView(context:Omit<RoleViewToken,'expiresAt'>,sessionId:string,now?:number):string;
export function readRoleView(token:string|undefined,sessionId:string|undefined,now?:number):RoleViewToken|null;
