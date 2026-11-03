export const clubViewRoles:string[];
export function roleViewLabel(role:string):string;
export function roleViewLanding(role:string):string;
export function roleViewMutationAllowed(path:string,role:string):boolean;
export function roleViewScopeAllowed(view:{clubId:string;role:string}|null|undefined,clubId:string,kind:'player'|'coach'|'admin'):boolean;
export function roleViewSameOrigin(origin:string|null,url:string,host:string|null):boolean;
