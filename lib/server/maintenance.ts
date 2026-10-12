import { dbQuery } from "@/lib/server/db";

export type MaintenanceMode = {
  enabled: boolean;
  updatedAt: string | null;
};

const defaultMaintenanceMode: MaintenanceMode = {
  enabled: false,
  updatedAt: null
};

function isMissingMaintenanceTable(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "42P01");
}

export async function loadMaintenanceMode(): Promise<MaintenanceMode> {
  try {
    const result = await dbQuery<{ enabled: boolean; updated_at: Date | string }>(
      `select enabled, updated_at
       from public.maintenance_mode
       where singleton = true
       limit 1`
    );
    const row = result.rows[0];
    if (!row) return defaultMaintenanceMode;
    return {
      enabled: Boolean(row.enabled),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)
    };
  } catch (error) {
    if (isMissingMaintenanceTable(error)) return defaultMaintenanceMode;
    throw error;
  }
}

export async function setMaintenanceMode(enabled: boolean, personId: string): Promise<MaintenanceMode> {
  const result = await dbQuery<{ enabled: boolean; updated_at: Date | string }>(
    `insert into public.maintenance_mode (singleton, enabled, updated_by, updated_at)
     values (true, $1::boolean, $2::uuid, now())
     on conflict (singleton) do update
       set enabled = excluded.enabled,
           updated_by = excluded.updated_by,
           updated_at = excluded.updated_at
     returning enabled, updated_at`,
    [enabled, personId]
  );
  const row = result.rows[0];
  return {
    enabled: Boolean(row.enabled),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)
  };
}

export async function isPlatformOperator(personId: string) {
  const result = await dbQuery(
    `select 1
     from public.app_operator
     where person_id = $1::uuid and active = true
     limit 1`,
    [personId]
  );
  return result.rowCount === 1;
}

export async function maintenanceSessionAccess(sessionId: string | undefined) {
  if (!sessionId) return { hasSession: false, platformAdmin: false };

  const result = await dbQuery<{ platform_admin: boolean }>(
    `select exists (
       select 1
       from public.app_session s
       join public.user_account ua on ua.id = s.user_account_id and ua.active = true
       join public.person p on p.id = ua.person_id and p.active = true
       join public.app_operator ao on ao.person_id = p.id and ao.active = true
       where s.id = $1::text and s.expires_at > now()
     ) as platform_admin
     where exists (
       select 1
       from public.app_session s
       join public.user_account ua on ua.id = s.user_account_id and ua.active = true
       join public.person p on p.id = ua.person_id and p.active = true
       where s.id = $1::text and s.expires_at > now()
     )`,
    [sessionId]
  );

  if (!result.rows[0]) return { hasSession: false, platformAdmin: false };
  return { hasSession: true, platformAdmin: Boolean(result.rows[0].platform_admin) };
}
