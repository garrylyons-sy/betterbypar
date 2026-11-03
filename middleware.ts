import {roleViewCookie,resolveRoleView} from '@/lib/server/role-view';
import {roleViewMutationAllowed,roleViewSameOrigin} from '@/shared/admin-role-view.mjs';
import {dbQuery} from '@/lib/server/db';
import { NextRequest, NextResponse } from "next/server";

import { maintenanceRequestDecision } from "@/lib/maintenance-policy.mjs";
import { loadMaintenanceMode, maintenanceSessionAccess } from "@/lib/server/maintenance";

export async function middleware(request: NextRequest) {
  const roleToken=request.cookies.get(roleViewCookie)?.value;
  if(roleToken&&request.nextUrl.pathname.startsWith('/api/')&&request.nextUrl.pathname!=='/api/admin/role-view'&&!['GET','HEAD','OPTIONS'].includes(request.method)){
    try{
      if(!roleViewSameOrigin(request.headers.get('origin'),request.url,request.headers.get('host')))throw new Error('Same-origin request required.');
      const sessionId=request.cookies.get('is_session')?.value??'';
      const actor=(await dbQuery<{accountId:string;personId:string;name:string;email:string;username:string;profileImage:string}>(`select ua.id as "accountId",p.id as "personId",concat_ws(' ',p.first_name,p.last_name) as name,coalesce(p.email,'') as email,ua.username,coalesce(p.profile_image,'') as "profileImage" from app_session s join user_account ua on ua.id=s.user_account_id and ua.active join person p on p.id=ua.person_id and p.active where s.id=$1 and s.expires_at>now()`,[sessionId])).rows[0];
      if(!actor)throw new Error('Sign in again.');
      const effective=await resolveRoleView(actor,sessionId,roleToken);
      if(!roleViewMutationAllowed(request.nextUrl.pathname,effective.actingAs!.role))throw new Error('Return to Admin to change account settings or perform this action.');
      await dbQuery(`insert into user_activity_log(person_id,activity_type,page_path,page_label,metadata) values($1,'Page Visit',$2,'Working role action requested',$3::jsonb)`,[actor.personId,request.nextUrl.pathname,JSON.stringify({effectivePersonId:effective.personId,...effective.actingAs,method:request.method})]);
    }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Role authorization unavailable.'},{status:403,headers:{'Cache-Control':'no-store'}});}
  }
  const maintenance = await loadMaintenanceMode().catch(() => ({ enabled: false, updatedAt: null }));
  const access = maintenance.enabled
    ? await maintenanceSessionAccess(request.cookies.get("is_session")?.value).catch(() => ({ hasSession: false, platformAdmin: false }))
    : { hasSession: false, platformAdmin: false };
  const decision = maintenanceRequestDecision({
    pathname: request.nextUrl.pathname,
    maintenanceEnabled: maintenance.enabled,
    ...access
  });

  if (decision === "block-api") {
    return NextResponse.json(
      { error: "Interclub Snooker is down for maintenance." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (decision === "show-maintenance") {
    const response = NextResponse.rewrite(new URL("/maintenance", request.url));
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|icons|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|webmanifest)$).*)"],
  runtime: "nodejs"
};
