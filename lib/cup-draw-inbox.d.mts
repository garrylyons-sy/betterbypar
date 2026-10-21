export function cupDrawInboxContent(body:string):{
 summary:string;
 rounds:{name:string;date:string;matches:{number:string;text:string}[]}[];
 schedule:{name:string;date:string}[];
 notes:string[];
 footer:string|null;
};

export function withCupDrawWitness(body:string,details?:{drawnAt?:string|Date|null;witnessName?:string|null}):string;
