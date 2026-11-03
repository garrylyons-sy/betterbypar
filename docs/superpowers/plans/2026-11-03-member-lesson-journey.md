# Member lesson journey

Goal: make booking, scheduled lessons and previous lesson coaching easy to use on web and native.

Use the existing authenticated /api/lessons service and booking/reminder transactions. Keep professional availability authoritative: no invented production schedules or past lessons. Reuse booking and feedback records, and preserve guardian access and attendee privacy.

- Add shared lesson status and three-section presentation, including lessons currently in progress.
- Make bookings compact, selectable summaries which open details (goals, reminder/cancel controls, completed feedback/drills, practice link). Notification targets open the correct detail.
- Group native availability into easy-to-scan professional/time choices; retain player eligibility and booking reconciliation.
- Apply the same Book / Scheduled / Previous flow and details to the website, using club theme colours.
- Verify classification, detail selection, booking/cancellation and feedback permissions with focused tests; run root/native TypeScript and lint. Validate both client builds and publish/install once verified.
