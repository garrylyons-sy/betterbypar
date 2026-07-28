import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { clearSessionCookie, recordLogin, setSessionCookie } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TestAccountRow = {
  account_id: string;
  person_id: string;
  username: string;
  email: string | null;
  first_name: string;
  last_name: string;
  profile_image: string | null;
};

function redirectWithAuthCode(request: NextRequest, code: string) {
  const destination = new URL("/", request.url);
  destination.searchParams.set("auth", code);
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function normalizeTestUser(value: string | null) {
  const user = value?.trim().toLowerCase() ?? "";
  if (!user) return null;
  return user.includes("@") ? user : `${user}@notrealmail.com`;
}

export async function GET(request: NextRequest) {
  const email = normalizeTestUser(request.nextUrl.searchParams.get("user"));

  if (!email) {
    return redirectWithAuthCode(request, "test-user-required");
  }

  if (!email.endsWith("@notrealmail.com")) {
    return redirectWithAuthCode(request, "test-user-not-allowed");
  }

  const { rows } = await dbQuery<TestAccountRow>(
    `select
       ua.id as account_id,
       ua.person_id,
       ua.username,
       p.email,
       p.first_name,
       p.last_name,
       p.profile_image
     from public.user_account ua
     join public.person p on p.id = ua.person_id
     left join public.app_operator ao on ao.person_id = p.id and ao.active = true
     where ua.active = true
       and p.active = true
       and ao.person_id is null
       and lower(p.email) = $1
       and lower(p.email) like '%@notrealmail.com'
     limit 1`,
    [email]
  );

  const account = rows[0];
  if (!account) {
    return redirectWithAuthCode(request, "test-user-not-found");
  }

  await clearSessionCookie();
  await setSessionCookie(account.account_id);
  await dbQuery("update public.user_account set last_login = now() where id = $1", [account.account_id]);
  await recordLogin(
    {
      accountId: account.account_id,
      personId: account.person_id,
      username: account.username,
      email: account.email ?? "",
      name: `${account.first_name} ${account.last_name}`.trim(),
      profileImage: account.profile_image ?? ""
    },
    "test_impersonation",
    (await headers()).get("user-agent") ?? ""
  );

  const response = NextResponse.redirect(new URL("/", request.url));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
