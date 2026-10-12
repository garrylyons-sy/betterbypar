export function shouldShowMaintenance(pathname, enabled) {
  if (!enabled) return false;
  return pathname !== "/maintenance" && !pathname.startsWith("/admin");
}

export function canSignInDuringMaintenance({ maintenanceEnabled, adminIntent, platformAdmin }) {
  return !maintenanceEnabled || (adminIntent && platformAdmin);
}
