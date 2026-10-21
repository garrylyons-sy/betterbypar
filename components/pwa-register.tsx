"use client";

import { useEffect } from "react";

import { shouldReloadForAppVersion } from "@/lib/app-version.mjs";

const VERSION_CHECK_COOLDOWN_MS = 5 * 60 * 1000;

export function PwaRegister({ deploymentVersion }: { deploymentVersion: string }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let checkingVersion = false;
    let lastVersionCheckAt = 0;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };
    const checkVersion = async () => {
      const now = Date.now();
      if (document.visibilityState !== "visible" || checkingVersion || now - lastVersionCheckAt < VERSION_CHECK_COOLDOWN_MS) return;
      checkingVersion = true;
      lastVersionCheckAt = now;
      try {
        const response = await fetch("/api/app-version", { cache: "no-store", credentials: "same-origin" });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && shouldReloadForAppVersion(deploymentVersion, String(payload.version ?? ""))) {
          window.location.reload();
        }
      } catch {
        // A later app resume will retry without interrupting the current session.
      } finally {
        checkingVersion = false;
      }
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    document.addEventListener("visibilitychange", checkVersion);

    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", checkVersion);
    };
  }, [deploymentVersion]);

  return null;
}
