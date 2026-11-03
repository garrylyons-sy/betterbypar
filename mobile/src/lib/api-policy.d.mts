export function apiOrigin(value:string,development?:boolean):string;
export function apiPath(value:string):string;

export type ApiMethod='GET'|'POST'|'PATCH'|'DELETE';
export function apiRequestOptions(body?:unknown,method?:ApiMethod):{method:ApiMethod;body?:string|FormData;headers?:Record<string,string>};

export function defaultApiOrigin(configured?:string|null,development?:boolean):string;
