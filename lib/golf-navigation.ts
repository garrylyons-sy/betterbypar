import type {Role,AppearanceMenuId} from '@/lib/types';
export function isGolfRole(role:Role){return ['Club Member','Club Admin','Golf Professional','Assistant Professional'].includes(role);}
export const golfMenuItems:AppearanceMenuId[]=['Home','My Golf','Lessons','Club'];
