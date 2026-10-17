"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { shouldShowMaintenance } from "@/lib/maintenance-policy.mjs";
import { MaintenancePage } from "@/components/maintenance-page";

const MAINTENANCE_POLL_MS = 15 * 60 * 1000;
const VISIBILITY_REFRESH_COOLDOWN_MS = 5_000;

export function MaintenanceGate({ initialEnabled, children }: { initialEnabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [enabled, setEnabled] = useState(initialEnabled);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    let cancelled = false;
    let refreshInFlight = false;
    let lastRefreshAt = 0;

    async function refresh() {
      const now = Date.now();
      if (document.visibilityState !== "visible" || refreshInFlight || now - lastRefreshAt < VISIBILITY_REFRESH_COOLDOWN_MS) return;
      lastRefreshAt = now;
      refreshInFlight = true;
      try {
        const response = await fetch("/api/maintenance", { cache: "no-store", credentials: "same-origin" }).catch(() => null);
        if (!response?.ok) return;
        const data = await response.json().catch(() => ({}));
        if (!cancelled) setEnabled(Boolean(data.enabled));
      } finally {
        refreshInFlight = false;
      }
    }

    const interval = window.setInterval(refresh, MAINTENANCE_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  if (shouldShowMaintenance(pathname, enabled)) return <MaintenancePage />;
  return children;
}
