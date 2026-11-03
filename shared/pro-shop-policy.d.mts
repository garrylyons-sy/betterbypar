import type {ShopSettings,ShopAdminProduct} from './pro-shop-contracts';
export const defaultShopSettings:ShopSettings;
export function shopifyDomain(value:unknown):string;
export function safeShopUrl(value:unknown,options?:{httpsOnly?:boolean}):string;
export function normalizeShopSettings(value:unknown):ShopSettings;
export function normalizeShopProduct(value:unknown):Omit<ShopAdminProduct,'id'>;
export function shopRoleAllowed(view:{clubId:string;role:string}|null|undefined,clubId:string,manage?:boolean):boolean;
