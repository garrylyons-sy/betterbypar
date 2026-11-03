# Pro shop and advertising

User requests an advert functionality audit and shop front, potentially Shopify. Existing shared backend, web/native parity, no commits without request.

Ruling: per-club Pro shop, separate from credit-only second-hand scaffolding. Add a working managed catalogue plus optional Shopify Storefront adapter and hosted checkout. No paid store creation, subscription or financial transaction. No invented live products. Existing global snooker product/order tables remain separate because they are not club-scoped.

1. Audit existing ads management/display/eligibility/click tracking against actual DB and tests. Repair concrete gaps and add native home display through authenticated shared endpoint, safe URLs, honest reporting.
2. Shared shop contracts and policy, additive club-scoped settings/products migration, membership/admin/pro checks, authenticated catalogue/search and settings/products management APIs. Shopify 2026-10 API, validated *.myshopify.com domain only, bounded queries/timeouts, server-only optional public Storefront token map. Product catalogue and variant validation; hosted checkout, no local payment handling. No customer PII forwarded automatically.
3. Web/native Pro shop browse/search/variants/checkout; loading/empty/error/disabled states. Link under Club/More; staff manage from admin/clubadmin Pro shop. No new bottom tab. Keep professionals in professional workspace.
4. Focused integration tests incl cross-club/revoked/working-role requests, archived products, malicious URLs, Shopify errors and variant checks. Root/mobile TS, native lint, full suite. Independent code review and browser checks; additive DB apply then deployment under existing session authorization. Build native package; do not claim phone install unless verified.

Credentials/store connection is optional: no store details given. No Shopify store is created or purchased; document connection steps and leave live unconfigured until supplied.
