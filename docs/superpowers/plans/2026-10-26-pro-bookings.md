# Professional-assisted lesson booking

Pros/assistants may book an available30minute slot in their own diary for an active member of that club. Preserve booked_by as professional for audit. Select active member in diary slot action; optional goals and reminder, existing slot locks and player overlaps prevent duplicates. No arbitrary other-club or other-coach bookings.

API GET /api/admin/lesson-bookings?clubId= returns {members:[{id,name,on_platform:boolean}]}; only actively appointed coaches at club (or admins for directoryread). POST /api/admin/lesson-bookings {slotId,playerId,goals,reminderMinutes} => {booking:{id},notified:number}. Only assigned lesson coach can POST. UI shows whether recipient hasplatformaccount and notes guardiansmaybenotified.

Notification: new native lesson_booking type available for active club roles without broadening legacy notification types. Transactionally notify member's active platformaccount and active registered guardians (deduplicate); recipients constrained to club. href /lessons?booking=<uuid>#booking-<uuid>. Memberdeeplink opens bookings tab, sets history forpast/cancelled, highlights and scrolls relevantcard; invalid/nonowned links reveal no booking details. Add shared notification bell to Lessons pages so local demo notifications are discoverable. Main app alreadyhasbell. Click uses fullpage navigationfor/lessons destination.

Reminders: new reminder_person_id points to member account or guardian; booked_by remains coach. Offline member without eligibleaccount gets no emailreminder. Cancelledbooking notifications expire/sourcecheck onread.

Migration lesson_booking_notifications.sql after lesson_diary.sql and notifications.sql. Localstartup loadsbase notifications ifabsent thennewmigration. Fullnative notification type policy, config/preferences upgrade and source authorization. Test probooking/notification/deeplinkscopes and duplicates; review and browserverification. No commit/push.

Verified: 546 tests pass, TypeScript passes, real HTTP pro/member/assistant/guardian flows pass. Browser confirmed a professional booking for Morgan Kelly, the Home notification bell showing the new item, and navigation from that item to the exact booking URL. Review found an assisted-booking reminder reactivation gap; PATCH now explicitly sets delivery to the authenticated authorized member/guardian and the HTTP regression passes. No commits/pushes.
