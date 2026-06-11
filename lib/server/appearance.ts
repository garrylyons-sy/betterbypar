import { defaultAppearanceConfig, normalizeAppearanceConfig } from "@/lib/appearance";
import type { AppearanceConfig, AppearanceMenuId, AppearancePanelId, Role } from "@/lib/types";
import { dbQuery } from "@/lib/server/db";

type AppearanceRow = {
  role_type: Role;
  panel_config: AppearancePanelId[];
  menu_config: AppearanceMenuId[];
};

export async function loadAppearanceConfig(): Promise<AppearanceConfig> {
  try {
    const result = await dbQuery<AppearanceRow>(
      `select role_type, panel_config, menu_config
       from public.appearance
       where active = true`
    );

    const partial = result.rows.reduce<Partial<AppearanceConfig>>((config, row) => {
      config[row.role_type] = {
        role: row.role_type,
        panels: row.panel_config,
        menuItems: row.menu_config
      };
      return config;
    }, {});

    return normalizeAppearanceConfig(partial);
  } catch {
    return defaultAppearanceConfig;
  }
}

export async function saveRoleAppearance(role: Role, panels: AppearancePanelId[], menuItems: AppearanceMenuId[], updatedBy?: string) {
  const normalized = normalizeAppearanceConfig({
    [role]: {
      role,
      panels,
      menuItems
    }
  });
  const roleConfig = normalized[role];

  await dbQuery(
    `insert into public.appearance (role_type, panel_config, menu_config, active, updated_by)
     values ($1, $2::jsonb, $3::jsonb, true, $4)
     on conflict (role_type) do update
     set panel_config = excluded.panel_config,
         menu_config = excluded.menu_config,
         active = true,
         updated_by = excluded.updated_by,
         updated_at = now()`,
    [role, JSON.stringify(roleConfig.panels), JSON.stringify(roleConfig.menuItems), updatedBy ?? null]
  );

  return roleConfig;
}
