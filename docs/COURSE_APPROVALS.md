# Manual course approval

Players can enter a course manually and save or play that round immediately, on web or native. Saving a manual round creates a pending `golf_course_submission` in the same transaction. Repeated saves update the pending submission instead of adding duplicates. Only course names, tees and hole pars are submitted for review; scores and player commentary are not copied into the queue.

The shared `/api/courses` catalogue continues to return only active published courses with complete selectable tee scorecards. Pending and rejected submissions never appear there. The player's original round is preserved through approval or rejection, and publishing never rewrites its saved reference data.

Platform administrators use **Admin → Courses**. They may match an entry to an existing published course/tee, publish a new reviewed course, or reject it with a note. New publication requires a club name, course/layout, tee name, a public scorecard source and all 18 hole pars. Optional unverified course/slope ratings remain null. A nine-hole submission is usable by its player but needs its full reference card verified before joining the shared 18-hole catalogue. Approval/rejection and publication are transactional and audited; already-reviewed requests return a conflict rather than publishing twice.

`supabase/manual_course_approval.sql` adds the private review queue with RLS enabled and no direct anonymous/authenticated database access. It is included in the clean installer and local demo initialization. Existing installations must apply this additive migration before deploying the new round-save code. No existing course or round is changed by the migration.

Web setup starts with the club selector, then exposes layouts and rated tees. The remaining round fields appear after a tee has loaded, or after explicitly choosing manual entry. Native uses a searchable course/tee picker and the same save/review backend.
