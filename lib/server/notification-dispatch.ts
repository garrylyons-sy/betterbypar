import {processNotificationEmail,notificationEmailReady} from '@/lib/server/notification-email';
import {after} from 'next/server';
import {processNotificationPush, pushReadiness} from '@/lib/server/notification-push';
// Keep provider I/O outside the mutation transaction and response. The scheduled
// worker recovers failed or interrupted deliveries from the durable outbox.
export function scheduleNotificationPush() {
  if (!pushReadiness().ready&&!notificationEmailReady()) return;
  after(async () => {
    try { await Promise.all([processNotificationPush(),processNotificationEmail()]); }
    catch { console.error('notifications:background-delivery failed'); }
  });
}
