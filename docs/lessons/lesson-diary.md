# Lessons

Professionals and assistants use /lessons/manage. The diary opens on this week; Day and Week switch the schedule view. Default week is a separate settings action: save usual hours once, including split shifts or days off. Edit this week overrides only the displayed week; Restore default hours removes that override. Current and next seven weeks are editable. Earlier weeks remain available for coaching notes.

Hours use Europe/Dublin, including daylight saving changes, and generate half-hour lessons. Nonexistent spring clock times are skipped. Booked times cannot be removed through availability changes; cancel the booking first. Professionals can edit only their own diary; appointed club admins and platform operators can manage relevant diaries. Only the appointed lesson coach can write feedback/drills, after the lesson ends.

Members use /lessons: select date, professional and time, then player (self or active dependant), optional goals and reminder. A reminder defaults to24hours; options are off,30minutes,1hour,2hours,24hours,48hours. Your bookings includes upcoming reminders and past lesson feedback/drills. A guardian can view notes for their active dependant.

## Database deployment

Apply supabase/lesson_diary.sql after golf_foundation.sql to the new database. It preserves historical lessons, adds weekly schedules and note/reminder fields, and backfills email jobs for upcoming bookings. Legacy non-half-hour slots remain in coaching history but cannot receive new bookings. New published lessons use30minutes.

Local demo applies this migration automatically on startup. It uses fictional pro/assistant defaults and half-hour slots; no outgoing email is sent. Availability and due reminders work locally.

## Reminder delivery

Configure RESEND_API_KEY and INVITE_FROM_EMAIL (or EMAIL_FROM), APP_URL/NEXT_PUBLIC_APP_URL and CRON_SECRET. Schedule an authenticated GET to /api/cron/lessons every5minutes with Authorization: Bearer <CRON_SECRET>. This also tops up the rolling eight-week availability horizon. Member and professional reads top up availability too.

Emails go to the account that booked the lesson, so a junior's guardian receives them. The worker rechecks active club, player, coach, account and guardian permissions. Cancelled/started lessons are skipped. Persistent leases and provider idempotency keys prevent duplicate sends across retries; failed deliveries retry up to5attempts. Due banners are shown in Lessons independently of email configuration. Email readiness is stated in the UI; there is no configured email provider or deployed scheduler in the current local demo.

The cron processes3emails/run with10second provider timeouts. Increase scheduler frequency for higher volumes; monitor sent/retried/skipped counters and lesson_reminder.last_error. Production deployment and email delivery remain to be configured when the separate Supabase account and domain are selected.

Verification: unit tests cover30minute boundaries, split shifts, overlaps, reminders and Dublin dates. PGlite tests cover generation, idempotence, booking protection, weekly overrides and DST transition gaps. scripts/verify-lesson-diary.mjs exercises normal HTTP login, ownership, booking goals/conflicts/reminders, cancellation, dependant selection and postlesson feedback visibility against localhost only.

## Bookings made by a professional

An assigned professional or assistant can select an available slot in their diary, choose **Book for a member**, and select an active member from that club. Optional goals and reminder settings are included. Administrators viewing someone else's diary cannot impersonate that coach to book.

The booking records the coach as its creator. In-app notifications go to the member's active account and active registered guardians, subject to notification preferences. Members without accounts can still have a booking; if no active guardian account exists, no notification or email reminder is claimed. The preferred reminder recipient is the member, otherwise an active guardian. A member/guardian who later changes their reminder becomes its delivery recipient.

Notifications appear in the existing bell on Home and Lessons. Clicking opens `/lessons?booking=<id>#booking-<id>`, selects the bookings section and highlights/focuses the specific lesson. Current membership and guardian access are rechecked; cancelled lessons disappear from the active notification inbox. The booking itself remains available in cancelled history.

Apply `supabase/lesson_booking_notifications.sql` after `lesson_diary.sql` and the base `notifications.sql`. Local startup applies missing notification setup automatically. The new `lesson_booking` category permits active golf club members/professionals without opening legacy match notifications to them. `scripts/verify-pro-lesson-booking.mjs` verifies local HTTP booking, duplicate rejection, audit actor, reminders, native inbox/read receipt, notification source access, guardian revocation and cancelled notification expiry.

## Named coaching groups

Use Lessons → Groups in the professional diary or club Lessons panel. Create a group such as Castle Cubs and choose:

- **Open bookings:** eligible members/guardians reserve individual places.
- **Fixed roster:** the professional selects active club players. Publishing a session books the active roster in one transaction, with member/guardian notifications. Book missing roster players adds newly rostered participants without duplicating existing bookings.

Maximum places is optional: leave it empty for no limit. A group default applies to new sessions. Each session can inherit the default, choose a different maximum or be uncapped. Existing session capacities are preserved when the group default changes. A fixed roster cannot exceed a capped default; a session cannot be published below its roster size. No player is silently dropped to fit a limit.

Sessions last30minutes to4hours in30minute blocks. Reserved group time replaces overlapping unbooked generated personal slots at the same club, while protecting booked lessons and other reserved sessions. Each participant has an individual booking, goals, reminder, cancellation, feedback and drills. Cancellation frees a capped place. Cancelling the session cancels all participant bookings; notifications/reminders then cease to be eligible. Other players' identities and feedback are never returned to ordinary members.

Roster changes affect future roster bookings, not existing reservations. Previously booked players retain their place until their booking is explicitly cancelled. Only the group's appointed active coach can change the group; administrators can view relevant groups. Professionals can also add players individually from the group session; fixed-roster membership is still required.

Apply `supabase/lesson_groups.sql` after `lesson_booking_notifications.sql`. Local startup applies it automatically and seeds a Castle Cubs group (open, samplecapacity8). Verification includes capped/unlimited/session privacy, duplicate protection, fixed-roster bulk booking, guardian access/notifications, cancellation, duration-accurate reminders and preserved one-to-one constraints. Local browser verification published a60minute Castle Cubs session and booked Casey Parker with a guardian notification.
