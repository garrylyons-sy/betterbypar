export const professionalRoles:string[];
export function isProfessional(roles:string[]):boolean;
export function golfCapabilities(roles?:string[]):{professional:boolean;canRecordRound:boolean;canUsePlayerTools:boolean;canCoach:boolean};
export const professionalMenuItems:{label:string;section:string;href:string}[];
