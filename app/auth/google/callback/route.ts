import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  claimInvitationForAccount,
  clearOAuthCookies,
  googleRedirectUri,
  readOAuthCookies,
  recordLogin,
  setSessionCookie,
  signInExistingGoogleUser
} from "@/lib/server/auth";
import { sendWelcomeEmail } from "@/lib/server/welcome-email";

export const runtime = "nodejs";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleUserInfo = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

export async function GET(request: NextRequest) {
  const origin = new URL("/", request.url);
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const oauthCookies = await readOAuthCookies();

  if (!code) return NextResponse.redirect(new URL("/?auth=missing-code", origin));
  if (!oauthCookies.state || oauthCookies.state !== returnedState) {
    clearOAuthCookies();
    return NextResponse.redirect(new URL("/?auth=bad-state", origin));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    clearOAuthCookies();
    return NextResponse.redirect(new URL("/?auth=google-not-configured", origin));
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: await googleRedirectUri(),
      grant_type: "authorization_code"
    })
  });
  const token = await tokenResponse.json() as GoogleTokenResponse;

  if (!tokenResponse.ok || !token.access_token) {
    clearOAuthCookies();
    return NextResponse.redirect(new URL(`/?auth=${encodeURIComponent(token.error || "token-failed")}`, origin));
  }

  const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` }
  });
  const googleUser = await userResponse.json() as GoogleUserInfo;

  if (!userResponse.ok || !googleUser.email || !googleUser.sub) {
    clearOAuthCookies();
    return NextResponse.redirect(new URL("/?auth=userinfo-failed", origin));
  }

  try {
    const user = oauthCookies.invitationCode
      ? await claimInvitationForAccount({
        email: googleUser.email,
        username: googleUser.email.split("@")[0],
        googleId: googleUser.sub,
        profileImage: googleUser.picture ?? null,
        invitationCode: oauthCookies.invitationCode
      })
      : await signInExistingGoogleUser(googleUser.sub, googleUser.email, googleUser.picture);

    if (!user) {
      throw new Error("No account exists for this Google email. Please use your invitation link first.");
    }

    await setSessionCookie(user.accountId);
    await recordLogin(user, "google", (await headers()).get("user-agent") ?? "");
    if (oauthCookies.invitationCode) {
      sendWelcomeEmail(user, request.url).catch(() => undefined);
    }
    clearOAuthCookies();

    const nextPath = oauthCookies.next && oauthCookies.next.startsWith("/") ? oauthCookies.next : "/";
    return NextResponse.redirect(new URL(nextPath, origin));
  } catch (error) {
    clearOAuthCookies();
    const reason = error instanceof Error ? error.message : "google-login-failed";
    return NextResponse.redirect(new URL(`/?auth=${encodeURIComponent(reason)}`, origin));
  }
}
