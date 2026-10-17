"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { shouldShowMaintenance } from "@/lib/maintenance-policy.mjs";
import { MaintenancePage } from "@/components/maintenance-page";

const MAINTENANCE_POLL_MS = 5 * 60 * 1000;

export function MaintenanceGate({ initialEnabled, children }: { initialEnabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [enabled, setEnabled] = useState(initialEnabled);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    let cancelled = false;

    async function refresh() {
      if (document.visibilityState !== "visible") return;
      const response = await fetch("/api/maintenance", { cache: "no-store", credentials: "same-origin" }).catch(() => null);
      if (!response?.ok) return;
      const data = await response.json().catch(() => ({}));
      if (!cancelled) setEnabled(Boolean(data.enabled));
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
