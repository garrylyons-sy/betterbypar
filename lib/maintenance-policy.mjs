export function shouldShowMaintenance(pathname, enabled) {
  if (!enabled) return false;
  return pathname !== "/maintenance" && pathname !== "/admin" && !pathname.startsWith("/admin/");
}

export function canSignInDuringMaintenance({ maintenanceEnabled, adminIntent, platformAdmin }) {
  return !maintenanceEnabled || (adminIntent && platformAdmin);
}

export function maintenanceRequestDecision({ pathname, maintenanceEnabled, hasSession = false, platformAdmin = false }) {
  if (!maintenanceEnabled) return "allow";

  if (
    pathname === "/maintenance"
    || pathname === "/api/maintenance"
    || pathname === "/api/login"
    || pathname === "/api/logout"
    || pathname === "/auth/google"
    || pathname === "/auth/google/callback"
  ) {
    return "allow";
  }

  const adminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const adminApi = pathname === "/api/admin" || pathname.startsWith("/api/admin/");

  if (adminApi) return platformAdmin ? "allow" : "block-api";
  if (adminPage) return !hasSession || platformAdmin ? "allow" : "show-maintenance";
  if (pathname === "/api" || pathname.startsWith("/api/")) return "block-api";
  return "show-maintenance";
}
