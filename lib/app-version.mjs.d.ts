export const DEVELOPMENT_APP_VERSION: "development";

export function deploymentAppVersion(environment?: Record<string, string | undefined>): string;

export function shouldReloadForAppVersion(currentVersion: string, latestVersion: string): boolean;
