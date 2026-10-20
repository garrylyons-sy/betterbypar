const STALE_CLIENT_PATTERNS = [
  /chunkloaderror/i,
  /loading (?:css )?chunk [^ ]+ failed/i,
  /failed to fetch dynamically imported module/i,
  /failed to load module script/i,
  /css_chunk_load_failed/i
];

export const CLIENT_RELOAD_COOLDOWN_MS = 60_000;

export function isLikelyStaleClientError(error) {
  const message = [error?.name, error?.message].filter(Boolean).join(": ");
  return STALE_CLIENT_PATTERNS.some((pattern) => pattern.test(message));
}

export function shouldAutoReloadClient(error, previousReloadAt, now = Date.now()) {
  if (!isLikelyStaleClientError(error)) return false;
  if (!Number.isFinite(previousReloadAt)) return true;
  return now - previousReloadAt >= CLIENT_RELOAD_COOLDOWN_MS;
}
