import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");

test("More menu relies on the header account menu for logout", () => {
  const moreMenu = source.slice(source.indexOf("function MoreMenu("), source.indexOf("function ShopPage("));
  const accountMenu = source.slice(source.indexOf("function AccountMenu("), source.indexOf("function PageLayout("));

  assert.doesNotMatch(moreMenu, /CardTitle>Account|Log out|onSignOut|userLabel/);
  assert.match(accountMenu, /Log out/);
  assert.match(accountMenu, /onSignOut/);
});
