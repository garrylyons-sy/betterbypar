import type {PoolClient} from 'pg';
import {currentUser,type AppUser} from '@/lib/server/auth';
import {withTransaction} from '@/lib/server/db';
import {AccessError,golfAudit} from '@/lib/server/golf-access';
import {defaultShopSettings,normalizeShopSettings,normalizeShopProduct,shopRoleAllowed} from '@/shared/pro-shop-policy.mjs';
import type {ShopSettings,ShopAdminProduct,ShopAdminResponse,ShopResponse} from '@/shared/pro-shop-contracts';
import {shopifyProducts,shopifyCheckout} from '@/lib/server/shopify-storefront';
const uuid=(v:unknown)=>{if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))throw new AccessError('Choose a valid club or product.',400);return v;};
async function signedIn(){const u=await currentUser();if(!u)throw new AccessError('Sign in to visit the pro shop.',401);return u;}
export async function shopGrant(c:Pick<PoolClient,'query'>,user:AppUser,clubId:string,manage=false,clubScope=false){
 if(!shopRoleAllowed(user.actingAs,clubId,manage))throw new AccessError('Switch to a role with access to this club shop.');
 const club=(await c.query('select id,name from public.club where id=$1 and active for share',[uuid(clubId)])).rows[0];if(!club)throw new AccessError('Club not found.',404);
 const person=(await c.query('select id from public.person where id=$1 and active for share',[user.personId])).rows[0];if(!person)throw new AccessError('This account is no longer active.');
 const account=(await c.query('select ua.id from public.user_account ua join public.person p on p.id=ua.person_id and p.active where ua.person_id=$1 and ua.active for share of ua,p',[user.actingAs?.actorPersonId??user.personId])).rows[0];if(!account)throw new AccessError('This account is no longer active.');
 const operators=(await c.query('select person_id from public.app_operator where person_id=$1 and active for share',[user.actingAs?.actorPersonId??user.personId])).rows;
 if(user.actingAs&&!operators.length)throw new AccessError('This working role is no longer available.');
 const memberships=(await c.query('select role,is_club_admin from public.club_membership where club_id=$1 and person_id=$2 and active for share',[clubId,user.personId])).rows;
 const admins=(await c.query('select person_id from public.club_admin where club_id=$1 and person_id=$2 and active for share',[clubId,user.personId])).rows;
 const admin=admins.length>0||memberships.some(r=>r.is_club_admin),professional=memberships.some(r=>['Golf Professional','Assistant Professional'].includes(r.role));
 const operator=!user.actingAs&&!clubScope&&operators.length>0;
 let canManage=operator||admin||professional;
 if(user.actingAs){const role=user.actingAs.role;const valid=role==='Club Admin'?admin:role==='Player'?memberships.length>0:memberships.some(r=>r.role===role);if(!valid)throw new AccessError('This club role is no longer active.');canManage=role==='Club Admin'?admin:['Golf Professional','Assistant Professional'].includes(role)&&professional;}
 if(manage?!canManage:!operator&&!memberships.length&&!admin)throw new AccessError(manage?'Professional or club administrator access required.':'Active club membership is required.');
 return {club,canManage};
}
async function settings(c:Pick<PoolClient,'query'>,clubId:string):Promise<ShopSettings>{const r=(await c.query('select * from public.pro_shop_settings where club_id=$1 for share',[clubId])).rows[0];return r?{enabled:r.enabled,title:r.title,description:r.description,provider:r.provider,shopifyDomain:r.shopify_domain}:{...defaultShopSettings};}
const productSelect=`id,title,description,category,image_url as "imageUrl",price::text,purchase_url as "purchaseUrl",available,active,sort_order as "sortOrder"`;
export async function getProShop(request:Request):Promise<ShopResponse>{
 const user=await signedIn(),p=new URL(request.url).searchParams,clubId=uuid(p.get('clubId')),q=(p.get('q')??'').trim();if(q.length>100)throw new AccessError('Search must be 100 characters or fewer.',400);
 const result=await withTransaction(async c=>{const grant=await shopGrant(c,user,clubId),config=await settings(c,clubId);const base={clubId,clubName:grant.club.name,settings:config,products:[],hasMore:false,canManage:grant.canManage};
  if(!config.enabled)return {...base,notice:'The club pro shop is not open yet.'};
  if(config.provider==='shopify')return base;
  const rows=(await c.query<ShopAdminProduct>(`select ${productSelect} from public.pro_shop_product where club_id=$1 and active and ($2='' or position(lower($2) in lower(title||' '||description||' '||category))>0) order by sort_order,title,id limit 25`,[clubId,q])).rows;
  return {...base,hasMore:rows.length>24,products:rows.slice(0,24).map(r=>({id:r.id,title:r.title,description:r.description,category:r.category,imageUrl:r.imageUrl,variants:[{id:r.id,title:'Standard',price:r.price,currency:'EUR',available:r.available}],...(r.available&&r.purchaseUrl?{purchaseUrl:r.purchaseUrl}:{})}))};
 });
 if(result.settings.enabled&&result.settings.provider==='shopify'){try{return {...result,...await shopifyProducts(result.settings.shopifyDomain,q)};}catch{return {...result,notice:'The connected shop is temporarily unavailable. Please try again later.'};}}
 return result;
}
export async function getShopAdmin(request:Request):Promise<ShopAdminResponse>{
 const user=await signedIn(),p=new URL(request.url).searchParams,clubScope=p.get('scope')==='club';
 return withTransaction(async c=>{
  const all=(await c.query<{id:string;name:string}>('select id,name from public.club where active order by name')).rows;
  const clubs:typeof all=[];for(const club of all){try{await shopGrant(c,user,club.id,true,clubScope);clubs.push(club);}catch(e){if(!(e instanceof AccessError))throw e;}}
  const requested=p.get('clubId');if(requested)uuid(requested);const selected=requested?clubs.find(cl=>cl.id===requested):clubs[0];if(!selected)throw new AccessError('Professional or club administrator access required.');
  return {clubs,clubId:selected.id,settings:await settings(c,selected.id),products:(await c.query<ShopAdminProduct>(`select ${productSelect} from public.pro_shop_product where club_id=$1 order by sort_order,title,id limit 500`,[selected.id])).rows};
 });
}
export async function mutateShop(request:Request,b:Record<string,unknown>){
 const user=await signedIn(),clubId=uuid(b.clubId),clubScope=b.scope==='club'||new URL(request.url).searchParams.get('scope')==='club';
 return withTransaction(async c=>{
  await c.query('select id from public.club where id=$1 for update',[clubId]);
  await shopGrant(c,user,clubId,true,clubScope);
  if(b.action==='settings'){
   let s:ShopSettings;try{s=normalizeShopSettings(b.settings);}catch(e){throw new AccessError((e as Error).message,400);}if(s.provider==='shopify'&&s.enabled&&!s.shopifyDomain)throw new AccessError('Add your Shopify store domain before enabling the shop.',400);
   await c.query(`insert into public.pro_shop_settings(club_id,enabled,title,description,provider,shopify_domain) values($1,$2,$3,$4,$5,$6) on conflict(club_id) do update set enabled=excluded.enabled,title=excluded.title,description=excluded.description,provider=excluded.provider,shopify_domain=excluded.shopify_domain,updated_at=now()`,[clubId,s.enabled,s.title,s.description,s.provider,s.shopifyDomain]);
  }else if(b.action==='product'){
   let v:Omit<ShopAdminProduct,'id'>;try{v=normalizeShopProduct(b.product);}catch(e){throw new AccessError((e as Error).message,400);}const input=b.product as Record<string,unknown>;
   const vals=[clubId,v.title,v.description,v.category,v.imageUrl,v.price,v.purchaseUrl,v.available,v.active,v.sortOrder];
   if(input.id){const result=await c.query(`update public.pro_shop_product set title=$2,description=$3,category=$4,image_url=$5,price=$6,purchase_url=$7,available=$8,active=$9,sort_order=$10,updated_at=now() where club_id=$1 and id=$11 returning id`,[...vals,uuid(input.id)]);if(!result.rows.length)throw new AccessError('Product not found in this club.',404);}
   else{const count=Number((await c.query('select count(*) from public.pro_shop_product where club_id=$1',[clubId])).rows[0].count);if(count>=500)throw new AccessError('The catalogue has reached its 500 product limit.',400);await c.query(`insert into public.pro_shop_product(club_id,title,description,category,image_url,price,purchase_url,available,active,sort_order) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,vals);}
  }else if(b.action==='archive'){
   const r=await c.query('update public.pro_shop_product set active=false,updated_at=now() where club_id=$1 and id=$2 returning id',[clubId,uuid(b.productId)]);if(!r.rows.length)throw new AccessError('Product not found in this club.',404);
  }else throw new AccessError('Choose a valid shop action.',400);
  await golfAudit(c,user.actingAs?.actorPersonId??user.personId,'Pro shop updated',{clubId,action:b.action,workingPersonId:user.personId});return {ok:true};
 });
}
export async function checkoutShop(request:Request,b:Record<string,unknown>){
 const user=await signedIn(),clubId=uuid(b.clubId);if(typeof b.quantity!=='number'||!Number.isInteger(b.quantity)||b.quantity<1||b.quantity>10)throw new AccessError('Choose a quantity between 1 and 10.',400);if(typeof b.productId!=='string'||typeof b.variantId!=='string'||b.productId.length>200||b.variantId.length>200)throw new AccessError('Choose a valid product variant.',400);
 return withTransaction(async c=>{
  await shopGrant(c,user,clubId);const s=await settings(c,clubId);if(!s.enabled)throw new AccessError('This club shop is not open.',400);
  if(s.provider==='shopify'){try{return await shopifyCheckout(s.shopifyDomain,b.productId as string,b.variantId as string,b.quantity as number);}catch(e){throw new AccessError((e as Error).message,400);}}
  const productId=uuid(b.productId);if(b.variantId!==productId)throw new AccessError('Choose a valid product variant.',400);
  const r=(await c.query('select purchase_url from public.pro_shop_product where id=$1 and club_id=$2 and active and available for share',[productId,clubId])).rows[0];if(!r)throw new AccessError('This product is no longer available.',400);if(!r.purchase_url)throw new AccessError('Contact the club professional to purchase this item.',400);return {checkoutUrl:r.purchase_url};
 });
}
export async function shopBody(request:Request):Promise<Record<string,unknown>>{
 if(!request.headers.get('content-type')?.includes('application/json'))throw new AccessError('Send JSON shop data.',400);
 const reader=request.body?.getReader();if(!reader)throw new AccessError('Shop data is required.',400);let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>20000)throw new AccessError('Shop data is too large.',413);chunks.push(part.value);}}finally{await reader.cancel();}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AccessError('Invalid shop data.',400);}if(!body||typeof body!=='object'||Array.isArray(body))throw new AccessError('Invalid shop data.',400);return body;
}
