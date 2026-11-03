import {shopifyDomain,safeShopUrl} from '@/shared/pro-shop-policy.mjs';
import type {ShopProduct} from '@/shared/pro-shop-contracts';
const error=()=>new Error('The connected shop is temporarily unavailable. Please try again.');
export async function storefront(domain:string,query:string,variables:Record<string,unknown>={},network:typeof fetch=fetch){
 const host=shopifyDomain(domain),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{
  const headers:Record<string,string>={'Content-Type':'application/json'};
  const tokens=JSON.parse(process.env.SHOPIFY_STOREFRONT_TOKENS_JSON||'{}');
  if(typeof tokens[host]==='string'&&tokens[host])headers['X-Shopify-Storefront-Access-Token']=tokens[host];
  const response=await network(`https://${host}/api/2026-10/graphql.json`,{method:'POST',headers,body:JSON.stringify({query,variables}),signal:controller.signal,redirect:'error',cache:'no-store'});
  if(!response.ok||Number(response.headers.get('content-length')||0)>2000000)throw error();
  const reader=response.body?.getReader();if(!reader)throw error();let size=0;const parts:Uint8Array[]=[];
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2000000)throw error();parts.push(part.value);}}finally{await reader.cancel();}
  const body=JSON.parse(Buffer.concat(parts).toString('utf8'));if(body.errors||!body.data)throw error();return body.data;
 }catch{throw error();}finally{clearTimeout(timer);}
}
const fields=`id title description productType featuredImage { url } variants(first:50) { nodes { id title availableForSale price { amount currencyCode } } }`;
function product(node:any):ShopProduct{
 if(!node||typeof node.id!=='string'||typeof node.title!=='string'||!Array.isArray(node.variants?.nodes))throw error();
 return {id:node.id,title:node.title,description:typeof node.description==='string'?node.description:'',category:typeof node.productType==='string'?node.productType:'',imageUrl:safeShopUrl(node.featuredImage?.url),variants:node.variants.nodes.filter((v:any)=>typeof v.id==='string'&&typeof v.title==='string'&&typeof v.price?.amount==='string'&&/^\d+(\.\d+)?$/.test(v.price.amount)&&typeof v.price.currencyCode==='string').map((v:any)=>({id:v.id,title:v.title,price:v.price.amount,currency:v.price.currencyCode,available:v.availableForSale===true}))};
}
export async function shopifyProducts(domain:string,search:string,network:typeof fetch=fetch){
 // Only letter/digit tokens enter Shopify's grammar; punctuation and operators cannot become syntax.
 const tokens=search.slice(0,100).toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0,6)??[];
 const q=tokens.map(word=>`(title:${word}* OR product_type:${word}*)`).join(' AND ');
 const data=await storefront(domain,`query Products($q:String){products(first:24,query:$q){nodes{${fields}} pageInfo{hasNextPage}}}`,{q:q||null},network);
 if(!Array.isArray(data.products?.nodes))throw error();return {products:data.products.nodes.map(product),hasMore:data.products.pageInfo?.hasNextPage===true};
}
export function safeCheckoutUrl(value:unknown,domain:string,onlineStoreUrl?:unknown){
 const clean=safeShopUrl(value,{httpsOnly:true});if(!clean)return '';const u=new URL(clean);let storeHost='';const online=safeShopUrl(onlineStoreUrl,{httpsOnly:true});if(online)storeHost=new URL(online).hostname;
 return [shopifyDomain(domain),'shopify.com','shop.app',storeHost].filter(Boolean).some(h=>u.hostname===h||(h==='shopify.com'||h==='shop.app')&&u.hostname.endsWith(`.${h}`))?clean:'';
}
export async function shopifyCheckout(domain:string,productId:string,variantId:string,quantity:number,network:typeof fetch=fetch){
 if(!Number.isInteger(quantity)||quantity<1||quantity>10)throw new Error('Choose a quantity between 1 and 10.');
 if(!/^gid:\/\/shopify\/Product\/\d+$/.test(productId)||!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(variantId))throw new Error('Choose a valid product variant.');
 const data=await storefront(domain,`query Variant($id:ID!){shop{primaryDomain{url}} node(id:$id){... on ProductVariant{id availableForSale product{id availableForSale} }}}`,{id:variantId},network);
 const variant=data.node;
 if(variant?.id!==variantId||variant.product?.id!==productId||variant.availableForSale!==true||variant.product.availableForSale!==true)throw new Error('This product variant is no longer available.');
 const cart=await storefront(domain,`mutation Cart($input:CartInput!){cartCreate(input:$input){cart{checkoutUrl lines(first:10){nodes{quantity merchandise{... on ProductVariant{id}}}}} userErrors{message} warnings{code}}}`,{input:{lines:[{merchandiseId:variantId,quantity}]}},network);
 if(cart.cartCreate?.userErrors?.length||cart.cartCreate?.warnings?.length||cart.cartCreate?.cart?.lines?.nodes?.length!==1||cart.cartCreate.cart.lines.nodes[0].quantity!==quantity||cart.cartCreate.cart.lines.nodes[0].merchandise?.id!==variantId)throw new Error('This product could not be added to checkout. Please try again.');
 const checkoutUrl=safeCheckoutUrl(cart.cartCreate?.cart?.checkoutUrl,domain,data.shop?.primaryDomain?.url);if(!checkoutUrl)throw error();return {checkoutUrl};
}
