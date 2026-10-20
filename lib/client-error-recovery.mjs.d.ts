export const CLIENT_RELOAD_COOLDOWN_MS: number;
export function isLikelyStaleClientError(error: unknown): boolean;
export function shouldAutoReloadClient(error: unknown, previousReloadAt: number | null, now?: number): boolean;
