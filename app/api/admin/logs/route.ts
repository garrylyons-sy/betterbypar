import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";

async function requireAdministrator() {
  const user = await currentUser();
  if (!user) return { user: null, administrator: false };
  const { rowCount } = await dbQuery(
    "select 1 from public.app_operator where person_id = $1 and active = true limit 1",
    [user.personId]
  );
  return { user, administrator: Boolean(rowCount) };
}

function validDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function pageNumber(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function pageSizeNumber(value: string | null) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return 50;
  return Math.min(100, Math.max(10, parsed));
}

export async function GET(request: NextRequest) {
  try {
    const { user, administrator } = await requireAdministrator();
    if (!user) return NextResponse.json({ authenticated: false, administrator: false }, { status: 401 });
    if (!administrator) return NextResponse.json({ authenticated: true, administrator: false, user }, { status: 403 });

    const params = request.nextUrl.searchParams;
    const from = validDate(params.get("from"));
    const to = validDate(params.get("to"));
    const personId = params.get("personId")?.trim() ?? "";
    const area = params.get("area")?.trim() ?? "";
    const page = pageNumber(params.get("page"));
    const pageSize = pageSizeNumber(params.get("pageSize"));
    const offset = (page - 1) * pageSize;
    const where: string[] = [];
    const values: unknown[] = [];

    if (from) {
      values.push(from);
      where.push(`l.created_at >= $${values.length}::date`);
    }
    if (to) {
      values.push(to);
      where.push(`l.created_at < ($${values.length}::date + interval '1 day')`);
    }
    if (personId && personId !== "all") {
      values.push(personId);
      where.push(`l.person_id = $${values.length}::uuid`);
    }
    if (area && area !== "all") {
      values.push(area);
      where.push(`coalesce(case when l.activity_type = 'Login' then 'Login' else nullif(l.page_label, '') end, nullif(l.page_path, ''), l.activity_type) = $${values.length}`);
    }

    const whereSql = where.length ? `where ${where.join(" and ")}` : "";
    const logsValues = [...values, pageSize, offset];
    const logs = await dbQuery<{
      id: string;
      activity_type: string;
      page_label: string | null;
      page_path: string | null;
      created_at: string;
      metadata: Record<string, unknown>;
      person_id: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    }>(
      `select
         l.id,
         l.activity_type,
         l.page_label,
         l.page_path,
         l.created_at,
         l.metadata,
         l.person_id,
         p.first_name,
         p.last_name,
         p.email
       from public.user_activity_log l
       left join public.person p on p.id = l.person_id
       ${whereSql}
       order by l.created_at desc
       limit $${values.length + 1}
       offset $${values.length + 2}`,
      logsValues
    );
    const total = await dbQuery<{ total: string }>(
      `select count(*)::text as total
       from public.user_activity_log l
       left join public.person p on p.id = l.person_id
       ${whereSql}`,
      values
    );
    const [people, areas] = await Promise.all([
      dbQuery<{ person_id: string; first_name: string | null; last_name: string | null; email: string | null }>(
        `select distinct
           p.id as person_id,
           p.first_name,
           p.last_name,
           p.email
         from public.user_activity_log l
         join public.person p on p.id = l.person_id
         order by p.first_name nulls last, p.last_name nulls last, p.email nulls last`
      ),
      dbQuery<{ area: string }>(
        `select area
         from (
           select coalesce(case when activity_type = 'Login' then 'Login' else nullif(page_label, '') end, nullif(page_path, ''), activity_type) as area
           from public.user_activity_log
         ) areas
         where area is not null
         group by area
         order by area`
      )
    ]);

    return NextResponse.json({
      logs: logs.rows.map((row) => ({
        id: row.id,
        activity_type: row.activity_type,
        page_label: row.page_label,
        page_path: row.page_path,
        created_at: row.created_at,
        metadata: row.metadata,
        personId: row.person_id,
        person: row.first_name || row.last_name || row.email ? {
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email
        } : null
      })),
      people: people.rows,
      areas: areas.rows.map((row) => row.area).filter(Boolean),
      total: Number(total.rows[0]?.total ?? 0),
      page,
      pageSize
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Activity logs unavailable." },
      { status: 500 }
    );
  }
}
