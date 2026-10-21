export const DEVELOPMENT_APP_VERSION = "development";

export function deploymentAppVersion(environment = process.env) {
  return environment.VERCEL_GIT_COMMIT_SHA
    || environment.VERCEL_DEPLOYMENT_ID
    || DEVELOPMENT_APP_VERSION;
}

export function shouldReloadForAppVersion(currentVersion, latestVersion) {
  if (!currentVersion || !latestVersion) return false;
  if (currentVersion === DEVELOPMENT_APP_VERSION || latestVersion === DEVELOPMENT_APP_VERSION) return false;
  return currentVersion !== latestVersion;
}
