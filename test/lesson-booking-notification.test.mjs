import test from 'node:test';
import assert from 'node:assert/strict';
import {isEligibleForNotification,defaultNotificationConfig,notificationTypes} from '../lib/notification-policy.mjs';
test('lesson bookings and other events follow the shared configured role eligibility',()=>{
 assert.ok(notificationTypes.includes('lesson_booking'));
 assert.equal(isEligibleForNotification('lesson_booking',['Club Member'],defaultNotificationConfig),true);
 assert.equal(isEligibleForNotification('fixture_change',['Club Member'],defaultNotificationConfig),true);
 assert.equal(isEligibleForNotification('lesson_booking',['Club Member'],{...defaultNotificationConfig,eligibleRoles:[]}),false);
 assert.equal(isEligibleForNotification('lesson_booking',['Viewing'],defaultNotificationConfig),false);
 assert.equal(isEligibleForNotification('lesson_booking',['Club Member'],{...defaultNotificationConfig,enabled:false}),false);
});
