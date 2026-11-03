export const clubViewRoles=['Player','Golf Professional','Assistant Professional','Club Admin'];
export const roleViewLabel=role=>role==='Golf Professional'?'Professional':role==='Assistant Professional'?'Assistant Professional':role==='Club Admin'?'Club Admin':'Player';
export const roleViewLanding=role=>role==='Club Admin'?'/clubadmin':role==='Golf Professional'||role==='Assistant Professional'?'/lessons/manage':'/';
export function roleViewMutationAllowed(path,role){
 if(path==='/api/admin/role-view')return true;
 if(path==='/api/page-visit'||path==='/api/ad-click')return true;
 const member=['/api/lessons','/api/rounds','/api/practice','/api/round-coaching'];
 if(member.includes(path)||path==='/api/pro-shop/checkout')return true;
 if(role!=='Player'&&path==='/api/admin/pro-shop')return true;
 if(role!=='Player'&&['/api/admin/lessons','/api/admin/lesson-availability','/api/admin/lesson-bookings','/api/admin/lesson-feedback','/api/admin/lesson-groups'].includes(path))return true;
 return role==='Club Admin'&&['/api/clubadmin','/api/admin/clubs','/api/admin/lesson-settings','/api/admin/lesson-locations'].includes(path);
}
export function roleViewScopeAllowed(view,clubId,kind){return !view||(view.clubId===clubId&&(kind==='player'?view.role==='Player':kind==='coach'?['Golf Professional','Assistant Professional'].includes(view.role):view.role==='Club Admin'));}
export function roleViewSameOrigin(origin,url,host){try{return new URL(origin).origin===`${new URL(url).protocol}//${host||new URL(url).host}`;}catch{return false;}}
