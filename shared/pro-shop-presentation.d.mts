import type {ShopProduct,ShopVariant} from './pro-shop-contracts';
export function shopMoney(value:string|number,currency?:string):string;
export function selectedShopVariant(product:ShopProduct,id?:string):ShopVariant|null;
export function shopPurchaseLabel(provider:string,product:ShopProduct,variant:ShopVariant|null):string;
