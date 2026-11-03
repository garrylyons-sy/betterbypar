# Club pro shop

Open **Pro shop** in Admin or Club administration, or **Manage pro shop** in a professional’s workspace. Members reach it through Club / More; the native app has a Pro shop screen under More.

Each club has an independent shop. Shops start closed and empty, with no invented stock or prices. Staff can prepare products, preview the shop and then enable **Open shop to members**.

## Managed catalogue

Add products with euro prices, categories, descriptions, optional image URLs and optional HTTPS purchase links. Published/available are separate flags. Archive removes an item from member browsing without deleting it. An item without a purchase link is marked **Available in pro shop**. This mode does not reserve stock, charge a card, or create local orders; an online purchase link opens the retailer’s website.

The second-hand clubs section remains separate. Its valuations represent pro shop credit, not cash payments.

## Shopify

Use an existing Shopify store. In shop settings choose Shopify and enter its permanent `your-store.myshopify.com` domain. Publish products to the appropriate Storefront sales channel. The app fetches products, variant prices and availability using Shopify Storefront API version `2026-10`. Selecting checkout creates a cart for the chosen variant and quantity, then opens Shopify’s hosted checkout. Shopify handles payment, fulfilment, shipping and order confirmation. Better By Par does not send a member’s personal profile to Shopify automatically.

Basic Storefront product/cart queries support tokenless access. If the store requires a public Storefront access token, an operator can configure `SHOPIFY_STOREFRONT_TOKENS_JSON` on the server (local `.env.local` and Vercel):

```json
{"your-store.myshopify.com":"public-storefront-access-token"}
```

Do not use a Shopify Admin API token or a private Storefront token in this variable. No tokens are stored in club settings or returned to clients. Do not put tokens in chat or commit them to Git.

A real Shopify store connection and end-to-end payment test require the store’s details. No Shopify store, subscription or paid order is created during platform setup.

## Database

Apply `supabase/pro_shop.sql` as an additive migration to an existing database. Clean installs include it through `scripts/supabase-install.mjs`. `pro_shop_settings` references one club; `pro_shop_product` references its club. Member, professional and administrator rights are checked by the shared backend. Browser and native clients use `/api/pro-shop` and `/api/pro-shop/checkout`; staff use `/api/admin/pro-shop`.

## Advertising

Admin → Adverts manages image/link, audience, active flag, priority and optional start/end dates. Everyone is the general golf audience; League chairs is a legacy audience that still requires that actual permission. Web and native Home display the eligible campaign. Click events are validated against the stored campaign. No campaign appears until an active eligible advert has been created.

Reference: [Shopify Storefront API](https://shopify.dev/docs/api/storefront/latest), [cart and hosted checkout](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage).
