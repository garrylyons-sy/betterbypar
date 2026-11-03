export type ShopSettings={enabled:boolean;title:string;description:string;provider:'catalogue'|'shopify';shopifyDomain:string};
export type ShopVariant={id:string;title:string;price:string;currency:string;available:boolean};
export type ShopProduct={id:string;title:string;description:string;category:string;imageUrl:string;variants:ShopVariant[];purchaseUrl?:string};
export type ShopResponse={clubId:string;clubName:string;settings:ShopSettings;products:ShopProduct[];hasMore:boolean;canManage:boolean;notice?:string};
export type ShopAdminProduct={id:string;title:string;description:string;category:string;imageUrl:string;price:string;purchaseUrl:string;available:boolean;active:boolean;sortOrder:number};
export type ShopAdminResponse={clubs:{id:string;name:string}[];clubId:string;settings:ShopSettings;products:ShopAdminProduct[]};
