export function normalizeGolfRegistration(input:{isGolfPlayer?:unknown;golfIrelandNumber?:unknown}){
 if(typeof input.isGolfPlayer!=='boolean')throw new Error('Choose whether this person is a registered player.');
 const number=String(input.golfIrelandNumber??'').trim();
 if(number&&!/^[0-9]{1,20}$/.test(number))throw new Error('Golf Ireland number must contain digits only (up to 20).');
 if(input.isGolfPlayer&&!number)throw new Error('Every player needs a Golf Ireland number.');
 return {isGolfPlayer:input.isGolfPlayer,golfIrelandNumber:number||null};
}
