# Golf platform foundation

Keep the Next.js client and app-managed sessions backed by Supabase PostgreSQL. React Native is future work; expose capabilities through JSON APIs. No live database configuration or migration is part of this change.

Extend club memberships and invitations with Golf Professional and Assistant Professional. Professionals have club-scoped lesson management, never automatic platform administration. Keep club administration and branding. Club saves require at least one administrator and Golf Professional; support multiple of each and zero or more assistants. Save appointments and branding atomically and protect required appointments in PostgreSQL.

A dependant is a person, optionally without login/email. A club-scoped dependants relationship links an active guardian to an active player with Parent, Guardian or Carer relationship. Administrators grant/revoke relationships. Guardians can view their dependants and book/cancel lessons for them without acquiring their login or administrative privileges. Multiple guardians and dependants are supported. Membership, person and relationship status are rechecked on each operation.

Lessons is independent from table bookings: professionals/admins publish one-to-one lesson slots, members/guardians book a player, and permitted users cancel. Prevent overlapping professional slots, duplicate slot reservations and overlapping player bookings. Persist actor separately from player. Display timezone explicitly. No payments, group classes or recurring schedules in this first version.

Admin adds Dependants, Lessons and an empty Challenges section. Existing invites continue with the new roles, and new clubs need no league teams to manage people.

Approach: extend the existing person/club model and add focused lesson and dependant tables/APIs. A separate identity system would duplicate existing invites and access controls; embedding dependants in account JSON would lose relational validation and auditability. Chosen by implementation judgment under AGENTS.md instructions to proceed end to end.
