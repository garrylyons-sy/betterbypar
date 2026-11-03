export const professionalRoles=['Golf Professional','Assistant Professional'];
export const isProfessional=roles=>roles.some(role=>professionalRoles.includes(role));
export function golfCapabilities(roles=[]){const professional=isProfessional(roles);return {professional,canRecordRound:!professional&&roles.some(r=>['Club Member','Player'].includes(r)),canUsePlayerTools:!professional,canCoach:professional};}
export const professionalMenuItems=[{label:'Home',section:'Home',href:'/'},{label:'Diary',section:'Lessons',href:'/lessons/manage'},{label:'Players',section:'My Golf',href:'/coaching/players'},{label:'Practice',section:'Club',href:'/practice/manage'},{label:'More',section:'Menu',href:'/?page=Menu'}];
