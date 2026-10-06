import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appShell = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/shop/route.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/shop.sql", import.meta.url), "utf8");

test("shop is only exposed to league chair access in the app shell", () => {
  assert.match(appShell, /type AppPage = [^;]*"Shop"/, "Shop should be a routed app page");
  assert.match(appShell, /activeTeam\.hasLeagueChairAccess[\s\S]*Shop/, "Shop tile should be gated by league chair access");
  assert.match(appShell, /if \(activePage === "Shop"\) return <ShopPage activeTeam=\{activeTeam\} \/>/, "Shop page should render through the app router");
});

test("shop API only returns products to league chairs", () => {
  assert.match(route, /cm\.role = 'League Chair'/, "Shop API should require league chair membership");
  assert.match(route, /from public\.product/, "Shop API should load rows from the product table");
  assert.match(route, /price_euros/, "Shop API should expose euro prices");
  assert.match(route, /option_values/, "Shop API should expose product options");
  assert.match(route, /export async function POST/, "Shop API should accept checkout orders");
  assert.match(route, /insert into public\.shop_order/, "Checkout should create a shop order");
  assert.match(route, /insert into public\.shop_order_item/, "Checkout should create order line items");
});

test("shop product table has the first t-shirt product", () => {
  assert.match(schema, /create table if not exists public\.product/, "Product table should be created");
  assert.match(schema, /product_name text not null/, "Product table should include product name");
  assert.match(schema, /description text not null/, "Product table should include description");
  assert.match(schema, /image_path text not null/, "Product table should include product image");
  assert.match(schema, /price_euros numeric\(8,2\) not null/, "Product table should include euro price");
  assert.match(schema, /option_name text/, "Product table should include an option name");
  assert.match(schema, /option_values text\[\]/, "Product table should include selectable option values");
  assert.match(schema, /create table if not exists public\.shop_order/, "Checkout should create an order table");
  assert.match(schema, /create table if not exists public\.shop_order_item/, "Checkout should create order item table");
  assert.match(schema, /Foul and a Miss Tee/, "First product should be the t-shirt");
  assert.match(schema, /\/shop\/foul-and-a-miss-tee\.png/, "First product should use the generated shirt image");
  assert.match(schema, /ARRAY\['S', 'M', 'L', 'XL', 'XXL'\]/, "The t-shirt should be seeded with sizes");
});

test("shop page supports size selection, cart and checkout", () => {
  assert.match(appShell, /selectedShopOptions/, "Shop page should track selected product options");
  assert.match(appShell, /Add to cart/, "Shop page should include add to cart controls");
  assert.match(appShell, /Your cart/, "Shop page should show a cart");
  assert.match(appShell, /Checkout/, "Shop page should include checkout");
  assert.match(appShell, /\/api\/shop[\s\S]*method: "POST"/, "Checkout should submit to the shop API");
});
