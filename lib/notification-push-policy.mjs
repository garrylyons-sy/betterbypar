export function validatePushSubscription(input) {
  if (!input || typeof input !== 'object' || typeof input.endpoint !== 'string' || input.endpoint.length > 2048) throw new Error('Invalid push subscription.');
  let endpoint;
  try { endpoint = new URL(input.endpoint); } catch { throw new Error('Invalid push endpoint.'); }
  const host = endpoint.hostname;
  const trusted = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'web.push.apple.com'].includes(host) || host.endsWith('.notify.windows.com');
  if (!trusted || endpoint.protocol !== 'https:' || endpoint.port || endpoint.username || endpoint.password || endpoint.hash) throw new Error('Unsupported push endpoint.');
  const {p256dh, auth} = input.keys || {};
  if (typeof p256dh !== 'string' || !/^[A-Za-z0-9_-]{87}={0,1}$/.test(p256dh) || typeof auth !== 'string' || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(auth)) throw new Error('Invalid push subscription keys.');
  const decoded = Buffer.from(p256dh, 'base64url');
  if (decoded.length !== 65 || decoded[0] !== 4 || Buffer.from(auth,'base64url').length !== 16) throw new Error('Invalid push subscription keys.');
  return {endpoint: endpoint.href, keys:{p256dh, auth}};
}

export function pushFailureAction(statusCode, attempts) {
  const deactivate = statusCode === 404 || statusCode === 410;
  const retry = !deactivate && attempts < 5 && (!statusCode || statusCode === 429 || statusCode >= 500);
  return {status: retry ? 'Pending' : 'Failed', deactivate, delaySeconds: retry ? Math.min(3600, 60 * 2 ** Math.max(0, attempts - 1)) : 0};
}
