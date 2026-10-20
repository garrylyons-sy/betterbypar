export type ValidPushSubscription = {endpoint:string;keys:{p256dh:string;auth:string}};
export function validatePushSubscription(input:unknown): ValidPushSubscription;
export function pushFailureAction(statusCode:number|undefined, attempts:number): {status:'Pending'|'Failed';deactivate:boolean;delaySeconds:number};
