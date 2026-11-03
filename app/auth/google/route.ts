import { NextRequest, NextResponse } from "next/server";

import { createToken, googleRedirectUri, setOAuthCookies } from "@/lib/server/auth";
import { loadMaintenanceMode } from "@/lib/server/maintenance";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/?auth=google-not-configured", request.url));
  }

  // OAuth cookies must be set on the same host as the configured callback.
  const redirectUri=await googleRedirectUri();
  const callbackOrigin=new URL(redirectUri).origin;
  if(new URL(request.url).origin!==callbackOrigin){const canonical=new URL(request.nextUrl.pathname+request.nextUrl.search,callbackOrigin);return NextResponse.redirect(canonical);}
  const state = createToken(24);
  const nextPath = request.nextUrl.searchParams.get("next") || "/";
  const maintenance = await loadMaintenanceMode();
  if (maintenance.enabled && nextPath !== "/admin") {
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }
  const inviteFromNext = nextPath.startsWith("/")
    ? new URL(nextPath, request.url).searchParams.get("invite")
    : null;
  const invitationCode = request.nextUrl.searchParams.get("invite") || inviteFromNext;
  await setOAuthCookies(state, nextPath, invitationCode);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "consent"
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
