import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { currentUser, sessionCookieName } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

type ScenarioId = "session" | "fixtures" | "bookings" | "competitions" | "admin";

type HarnessActor = {
  account_id: string;
  person_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string | null;
  is_platform_admin: boolean;
};

type ScenarioResult = {
  scenario: ScenarioId;
  label: string;
  ok: boolean;
  status: number;
  durationMs: number;
  detail: string;
};

const scenarioLabels: Record<ScenarioId, string> = {
  session: "Load home/session payload",
  fixtures: "Load fixture weeks",
  bookings: "Load Castle table bookings",
  competitions: "Load competitions",
  admin: "Check admin access"
};

function isScenario(value: unknown): value is ScenarioId {
  return typeof value === "string" && value in scenarioLabels;
}

function isLocalRequest(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  return host.includes("localhost") || host.includes("127.0.0.1");
}

async function isAllowed(request: NextRequest) {
  if (isLocalRequest(request)) return true;
  const user = await currentUser();
  if (!user) return false;
  const { rowCount } = await dbQuery(
    "select 1 from public.app_operator where person_id = $1 and active = true limit 1",
    [user.personId]
  );
  return Boolean(rowCount);
}

function todayDublin() {
  const parts = new Intl.DateTimeFormat("en-IE", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

async function createTemporarySession(accountId: string) {
  const sessionId = crypto.randomUUID();
  await dbQuery(
    `insert into public.app_session (id, user_account_id, expires_at)
     values ($1, $2, now() + interval '10 minutes')`,
    [sessionId, accountId]
  );
  return sessionId;
}

async function cleanupTemporarySession(sessionId: string) {
  await dbQuery("delete from public.app_session where id = $1", [sessionId]).catch(() => {});
}

async function timedJsonFetch(origin: string, path: string, sessionId: string) {
  const started = performance.now();
  const response = await fetch(new URL(path, origin), {
    headers: {
      cookie: `${sessionCookieName}=${sessionId}`,
      "x-interclub-test-harness": "true"
    },
    cache: "no-store"
  });
  const durationMs = Math.round(performance.now() - started);
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { response, durationMs, json, text };
}

function firstTeamContext(sessionPayload: unknown) {
  if (!sessionPayload || typeof sessionPayload !== "object") return null;
  const contexts = (sessionPayload as { contexts?: unknown }).contexts;
  if (!Array.isArray(contexts)) return null;
  return contexts.find((context) => {
    if (!context || typeof context !== "object") return false;
    const role = (context as { role?: unknown }).role;
    return role === "Player" || role === "Manager" || role === "Assistant Manager";
  }) as { league?: string; season?: string; teamId?: string } | undefined ?? null;
}

async function runScenario({
  actor,
  origin,
  sessionId,
  scenario,
  sessionPayload
}: {
  actor: HarnessActor;
  origin: string;
  sessionId: string;
  scenario: ScenarioId;
  sessionPayload: unknown;
}): Promise<{ result: ScenarioResult; sessionPayload?: unknown }> {
  if (scenario === "session") {
    const call = await timedJsonFetch(origin, "/api/session", sessionId);
    const body = call.json as { authenticated?: boolean; contexts?: unknown[]; error?: string } | null;
    const ok = call.response.ok && body?.authenticated === true && Array.isArray(body.contexts);
    return {
      sessionPayload: body,
      result: {
        scenario,
        label: scenarioLabels[scenario],
        ok,
        status: call.response.status,
        durationMs: call.durationMs,
        detail: ok ? `${body.contexts?.length ?? 0} context(s)` : body?.error ?? call.text.slice(0, 120)
      }
    };
  }

  if (scenario === "fixtures") {
    const context = firstTeamContext(sessionPayload);
    const league = encodeURIComponent(context?.league || "A League");
    const season = encodeURIComponent(context?.season && context.season !== "Club" ? context.season : "2026/27");
    const teamId = context?.teamId ? `&teamId=${encodeURIComponent(context.teamId)}` : "";
    const call = await timedJsonFetch(origin, `/api/fixtures/weeks?league=${league}&season=${season}${teamId}`, sessionId);
    const body = call.json as { weeks?: unknown[]; error?: string } | null;
    const ok = call.response.ok && Array.isArray(body?.weeks);
    return {
      result: {
        scenario,
        label: scenarioLabels[scenario],
        ok,
        status: call.response.status,
        durationMs: call.durationMs,
        detail: ok ? `${body?.weeks?.length ?? 0} week(s)` : body?.error ?? call.text.slice(0, 120)
      }
    };
  }

  if (scenario === "bookings") {
    const call = await timedJsonFetch(origin, `/api/table-bookings?date=${todayDublin()}`, sessionId);
    const body = call.json as { tables?: unknown[]; bookings?: unknown[]; error?: string } | null;
    const ok = (call.response.ok && Array.isArray(body?.tables) && Array.isArray(body?.bookings))
      || (call.response.status === 403 && Boolean(body?.error));
    return {
      result: {
        scenario,
        label: scenarioLabels[scenario],
        ok,
        status: call.response.status,
        durationMs: call.durationMs,
        detail: call.response.ok
          ? `${body?.tables?.length ?? 0} table(s), ${body?.bookings?.length ?? 0} booking(s)`
          : body?.error ?? call.text.slice(0, 120)
      }
    };
  }

  if (scenario === "competitions") {
    const call = await timedJsonFetch(origin, "/api/competitions", sessionId);
    const body = call.json as { competitions?: unknown[]; memberships?: unknown[]; error?: string } | null;
    const ok = call.response.ok && Array.isArray(body?.competitions) && Array.isArray(body?.memberships);
    return {
      result: {
        scenario,
        label: scenarioLabels[scenario],
        ok,
        status: call.response.status,
        durationMs: call.durationMs,
        detail: ok ? `${body?.competitions?.length ?? 0} competition(s)` : body?.error ?? call.text.slice(0, 120)
      }
    };
  }

  const call = await timedJsonFetch(origin, "/api/admin", sessionId);
  const body = call.json as { administrator?: boolean; authenticated?: boolean; error?: string } | null;
  const ok = actor.is_platform_admin ? call.response.ok && body?.administrator === true : call.response.status === 403;
  return {
    result: {
      scenario,
      label: scenarioLabels[scenario],
      ok,
      status: call.response.status,
      durationMs: call.durationMs,
      detail: actor.is_platform_admin
        ? (ok ? "administrator accepted" : body?.error ?? call.text.slice(0, 120))
        : (ok ? "non-admin rejected correctly" : body?.error ?? call.text.slice(0, 120))
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!await isAllowed(request)) {
      return NextResponse.json({ error: "Test harness access requires localhost or a platform administrator." }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as { actorAccountIds?: unknown; scenarios?: unknown } | null;
    const actorAccountIds = Array.isArray(body?.actorAccountIds)
      ? body.actorAccountIds.filter((id): id is string => typeof id === "string")
      : [];
    const scenarios: ScenarioId[] = Array.isArray(body?.scenarios)
      ? body.scenarios.filter(isScenario)
      : ["session", "fixtures", "bookings", "competitions"] satisfies ScenarioId[];

    if (!actorAccountIds.length) {
      return NextResponse.json({ error: "Select at least one actor." }, { status: 400 });
    }
    if (!scenarios.length) {
      return NextResponse.json({ error: "Select at least one scenario." }, { status: 400 });
    }

    const actors = await dbQuery<HarnessActor>(
      `select
         ua.id as account_id,
         ua.person_id,
         ua.username,
         p.first_name,
         p.last_name,
         p.email,
         coalesce(ao.active, false) as is_platform_admin
       from public.user_account ua
       join public.person p on p.id = ua.person_id
       left join public.app_operator ao on ao.person_id = p.id and ao.active = true
       where ua.id = any($1::uuid[])
         and ua.active = true
         and p.active = true
       order by coalesce(p.email, ua.username)`,
      [actorAccountIds]
    );

    const origin = request.nextUrl.origin;
    const actorRuns = [];
    for (const actor of actors.rows) {
      const sessionId = await createTemporarySession(actor.account_id);
      let sessionPayload: unknown = null;
      const results: ScenarioResult[] = [];
      try {
        const orderedScenarios: ScenarioId[] = scenarios.includes("session") ? scenarios : ["session", ...scenarios];
        for (const scenario of orderedScenarios) {
          const run = await runScenario({ actor, origin, sessionId, scenario, sessionPayload });
          if (scenario === "session") sessionPayload = run.sessionPayload ?? sessionPayload;
          if (scenarios.includes(scenario)) results.push(run.result);
        }
      } finally {
        await cleanupTemporarySession(sessionId);
      }
      actorRuns.push({
        accountId: actor.account_id,
        personId: actor.person_id,
        name: `${actor.first_name} ${actor.last_name}`.trim() || actor.username,
        email: actor.email,
        isPlatformAdmin: actor.is_platform_admin,
        ok: results.every((result) => result.ok),
        results
      });
    }

    const allResults = actorRuns.flatMap((run) => run.results);
    const durations = allResults.map((result) => result.durationMs);
    return NextResponse.json({
      ranAt: new Date().toISOString(),
      ok: actorRuns.every((run) => run.ok),
      actorRuns,
      summary: {
        actors: actorRuns.length,
        checks: allResults.length,
        passed: allResults.filter((result) => result.ok).length,
        failed: allResults.filter((result) => !result.ok).length,
        averageMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
        slowestMs: durations.length ? Math.max(...durations) : 0
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test run failed." },
      { status: 500 }
    );
  }
}
