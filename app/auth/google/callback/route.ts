import {googleAttemptFromNext,mobileGoogleReturn,authorizeMobileGoogle} from '@/lib/server/mobile-google';
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
import { isPlatformOperator, loadMaintenanceMode } from "@/lib/server/maintenance";

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
  email_verified?: boolean;
};

export async function GET(request: NextRequest) {
  const origin = new URL("/", request.url);
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const oauthCookies = await readOAuthCookies();
  const nativeAttempt=googleAttemptFromNext(oauthCookies.next);
  async function failure(reason:string){await clearOAuthCookies();return NextResponse.redirect(nativeAttempt?mobileGoogleReturn(nativeAttempt,reason):new URL(`/?auth=${encodeURIComponent(reason)}`,origin));}
  const maintenance = await loadMaintenanceMode();
  const adminIntent = oauthCookies.next === "/admin";

  if (maintenance.enabled && !adminIntent) {
    return failure("Better By Par is down for maintenance.");
  }

  if (!code) return failure(request.nextUrl.searchParams.get("error")==="access_denied"?"Google sign-in was cancelled.":"missing-code");
  if (!oauthCookies.state || oauthCookies.state !== returnedState) {
    return failure("bad-state");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return failure("Google sign-in is not configured yet.");
  }

  try {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal:AbortSignal.timeout(20000),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: await googleRedirectUri(),
      grant_type: "authorization_code"
    })
  });
  const token = await tokenResponse.json().catch(()=>({})) as GoogleTokenResponse;

  if (!tokenResponse.ok || !token.access_token) {
    return failure(token.error || "token-failed");
  }

  const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },signal:AbortSignal.timeout(20000)
  });
  const googleUser = await userResponse.json().catch(()=>({})) as GoogleUserInfo;

  if (!userResponse.ok || !googleUser.email || !googleUser.sub || googleUser.email_verified!==true) {
    return failure("Google could not verify your email address.");
  }

    const user = !maintenance.enabled && oauthCookies.invitationCode
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

    if (maintenance.enabled && !await isPlatformOperator(user.personId)) {
      await clearOAuthCookies();
      return NextResponse.redirect(new URL("/maintenance", origin));
    }

    if(nativeAttempt){const href=await authorizeMobileGoogle(nativeAttempt,user.accountId);await clearOAuthCookies();return NextResponse.redirect(href);}
    await setSessionCookie(user.accountId);
    await recordLogin(user, "google", (await headers()).get("user-agent") ?? "");
    if (oauthCookies.invitationCode) {
      sendWelcomeEmail(user, request.url).catch(() => undefined);
    }
    await clearOAuthCookies();

    const nextPath = oauthCookies.next && oauthCookies.next.startsWith("/") && !oauthCookies.next.startsWith("//") && !oauthCookies.next.includes("\\") ? oauthCookies.next : "/";
    return NextResponse.redirect(new URL(nextPath, origin));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "google-login-failed";
    return failure(reason);
  }
}
