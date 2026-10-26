# Lesson booking privacy

Each club controls whether members browsing lessons see the names of attending players. The default is off. Club administrators can change **Lesson booking privacy** under **Club branding**, or in the lesson diary; platform administrators can change it in the diary too. Professionals cannot change this club policy.

The switch applies to individual bookings and group sessions. When enabled, only attending player names are included in availability responses; goals, feedback, contact details and attendee IDs remain private. Cancelled bookings are excluded. When disabled, availability responses contain an empty `attendee_names` array. Members still see availability, booked times and group place counts, and retain access to their own/dependants’ booking details. Full sessions cannot be selected.

Professional management screens retain attendee access regardless of this setting. Fixed-roster sessions remain limited to eligible players and guardians.

Apply `supabase/lesson_booking_privacy.sql` after the existing golf and lesson migrations. The local demo applies this migration automatically without changing any saved club preference. Run `node --test test/lesson-privacy.test.mjs` and `node scripts/verify-lesson-privacy.mjs` to verify policy and local HTTP integration. The HTTP check restores the previous setting.
