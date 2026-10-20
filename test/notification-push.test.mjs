import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePushSubscription, pushFailureAction } from '../lib/notification-push-policy.mjs';

const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/device', keys: { p256dh: 'B' + 'A'.repeat(86), auth: 'A'.repeat(22) } };
test('accepts browser endpoints and rejects SSRF and misleading hosts', () => {
  assert.equal(validatePushSubscription(subscription).endpoint, subscription.endpoint);
  for (const endpoint of ['http://fcm.googleapis.com/x','https://localhost/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.com/x','https://user:pass@fcm.googleapis.com/x','https://fcm.googleapis.com:8443/x','https://evil.com/x']) {
    assert.throws(() => validatePushSubscription({...subscription, endpoint}));
  }
  for (const endpoint of ['https://updates.push.services.mozilla.com/wpush/v2/id','https://web.push.apple.com/id','https://wns2-par02p.notify.windows.com/id']) {
    assert.equal(validatePushSubscription({...subscription, endpoint}).endpoint, endpoint);
  }
});
test('rejects malformed or oversized subscription keys', () => {
  for (const keys of [{}, {p256dh:'oops',auth:'oops'}, {...subscription.keys,auth:'A'.repeat(1000)}]) assert.throws(() => validatePushSubscription({...subscription,keys}));
});
test('expired endpoints deactivate and transient failures have bounded retry', () => {
  assert.deepEqual(pushFailureAction(410,1), {status:'Failed',deactivate:true,delaySeconds:0});
  assert.deepEqual(pushFailureAction(404,1), {status:'Failed',deactivate:true,delaySeconds:0});
  assert.deepEqual(pushFailureAction(503,1), {status:'Pending',deactivate:false,delaySeconds:60});
  assert.deepEqual(pushFailureAction(429,5), {status:'Failed',deactivate:false,delaySeconds:0});
  assert.deepEqual(pushFailureAction(400,1), {status:'Failed',deactivate:false,delaySeconds:0});
});
